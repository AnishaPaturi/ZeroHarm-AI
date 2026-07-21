import asyncio
import sys
import os
import json
import logging

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.integration.task_queue import DistributedTaskQueue
from backend.app.integration.llm_cache import LLMSemanticCache

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_compute_layer")

async def test_semantic_cache():
    logger.info("--- Testing LLMSemanticCache (Option C: Semantic LLM Caching) ---")
    cache = LLMSemanticCache()
    cache.enabled = True
    
    prompt_1 = "OISD-105 safety guidelines for hot work permits in hydrocarbon processing units"
    completion_1 = "Compliance requires LOTO protocols, gas checks (CO < 25ppm), and fire watch standing."
    
    # 1. Set cache entry
    cache.set_cached_response(prompt_1, completion_1)
    
    # 2. Assert exact SHA-256 match
    exact_hit = cache.get_cached_response(prompt_1)
    assert exact_hit == completion_1, "Exact SHA-256 cache match failed"
    logger.info("Exact SHA-256 match passed.")
    
    # 3. Assert semantic match (slight variations)
    prompt_2 = "OISD-105 safety guidelines for hot work permits in hydrocarbon processing unit"
    # Token-wise Jaccard similarity is extremely high
    semantic_hit = cache.get_cached_response(prompt_2)
    assert semantic_hit == completion_1, "Semantic token Jaccard similarity cache match failed"
    logger.info("Semantic match passed.")
    
    # 4. Assert non-match (completely different prompt)
    prompt_3 = "DGMS circular on safety management plans and hazard identification"
    no_hit = cache.get_cached_response(prompt_3)
    assert no_hit is None, "Cache falsely matched a semantically distinct prompt"
    logger.info("Non-match test passed.")
    
    logger.info("LLMSemanticCache tests completed successfully!\n")


async def test_task_queue():
    logger.info("--- Testing DistributedTaskQueue (Option A: Asynchronous Tasks) ---")
    # Force queue enabled for unit testing
    queue = DistributedTaskQueue()
    queue.enabled = True
    
    # Register mock handler
    async def dummy_debate_handler(payload):
        logger.info(f"Worker handler running for zone: {payload['zone']}")
        return {
            "zone": payload["zone"],
            "risk_probability": 35.0,
            "prediction": "Atmospheric conditions dispersing gas. Low hazard profile."
        }
        
    handlers = {
        "collaborative_debate": dummy_debate_handler
    }
    
    broadcasts = []
    async def dummy_broadcast(payload):
        broadcasts.append(payload)
        logger.info(f"Broadcast received: Event={payload['event']} | Task={payload['task_id']} | Status={payload['status']}")
        
    # Start queue worker daemon in background
    worker_task = asyncio.create_task(queue.start_worker(handlers, dummy_broadcast))
    
    # Enqueue task
    task_id = await queue.enqueue_task("collaborative_debate", {"zone": "Sinter Plant"})
    logger.info(f"Task enqueued. Assigned ID: {task_id}")
    
    # Verify status is queued/pending or running
    initial_status = queue.get_task_status(task_id)
    assert initial_status is not None, "Task status record not created"
    
    # Wait for background consumer to process task
    await asyncio.sleep(0.5)
    
    # Verify completion status and results
    final_status = queue.get_task_status(task_id)
    assert final_status["status"] == "success", f"Task failed or in incorrect state: {final_status['status']}"
    assert final_status["result"]["risk_probability"] == 35.0, "Result payload mismatch"
    assert len(broadcasts) == 2, "Broadcast callback did not trigger for task start and finish"
    assert broadcasts[1]["status"] == "success", "Broadcast state was not success"
    
    # Stop background worker
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
        
    logger.info("DistributedTaskQueue tests completed successfully!\n")


async def main():
    logger.info("Starting Compute & Agent Reasoning Layer Unit Tests...")
    try:
        await test_semantic_cache()
        await test_task_queue()
        logger.info("ALL COMPUTE & REASONING LAYER TESTS PASSED SUCCESSFULLY!")
    except AssertionError as e:
        logger.error(f"TEST ASSERTION FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"An unexpected error occurred during compute testing: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
