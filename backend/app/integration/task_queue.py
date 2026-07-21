import asyncio
import os
import uuid
import logging
import json
from typing import Dict, Any, Callable, Optional
from datetime import datetime

logger = logging.getLogger("zeroharm_ai.task_queue")

# Try imports for distributed queuing
try:
    import redis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False

ASYNC_COMPUTE_ENABLED = os.getenv("ASYNC_COMPUTE_ENABLED", "false").lower() == "true"
DISTRIBUTED_STORAGE_ENABLED = os.getenv("DISTRIBUTED_STORAGE_ENABLED", "false").lower() == "true"


class DistributedTaskQueue:
    """
    Implements Option A: Distributed Task Queues (Celery / Dramatiq / Temporal equivalent).
    Offloads heavy operations (such as multi-round coordinator LLM debates)
    to background tasks to prevent blocking API request-response loops.
    """
    def __init__(self):
        self.enabled = ASYNC_COMPUTE_ENABLED
        self.local_queue = asyncio.Queue()
        self.client = None
        self.local_results: Dict[str, Any] = {}

        if self.enabled and DISTRIBUTED_STORAGE_ENABLED and HAS_REDIS:
            try:
                self.client = redis.Redis(
                    host=os.getenv("REDIS_HOST", "localhost"),
                    port=int(os.getenv("REDIS_PORT", 6379)),
                    password=os.getenv("REDIS_PASSWORD", None),
                    decode_responses=True,
                    socket_timeout=1.5
                )
                self.client.ping()
                logger.info("Successfully connected to Redis Task Queue broker.")
            except Exception as e:
                logger.error(f"Failed to connect to Redis queue: {e}. Falling back to in-memory Task Queue.")

    async def enqueue_task(self, task_type: str, payload: Dict[str, Any]) -> str:
        """Enqueues a compute-heavy task and returns a unique Task ID immediately."""
        task_id = f"task_{uuid.uuid4()}"
        task_entry = {
            "task_id": task_id,
            "task_type": task_type,
            "payload": payload,
            "status": "pending",
            "created_at": datetime.now().isoformat()
        }

        if self.client:
            try:
                # Save task metadata in cache
                self.client.set(f"zeroharm:task:{task_id}", json.dumps(task_entry), ex=3600) # 1-hour TTL
                # Push task to broker queue list
                self.client.rpush("zeroharm:task_queue", task_id)
                logger.info(f"Enqueued task {task_id} to Redis Queue.")
            except Exception as e:
                logger.error(f"Redis enqueue failed: {e}. Falling back to in-memory queue.")
                await self.local_queue.put(task_entry)
        else:
            self.local_results[task_id] = task_entry
            await self.local_queue.put(task_entry)

        return task_id

    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Queries the current status and results of a task."""
        if self.client:
            try:
                raw = self.client.get(f"zeroharm:task:{task_id}")
                if raw:
                    return json.loads(raw)
            except Exception as e:
                logger.error(f"Redis get_task_status failed: {e}")
        return self.local_results.get(task_id)

    def _update_task_result(self, task_id: str, status: str, result: Any):
        """Saves completion state and payload results of a background task."""
        task_data = self.get_task_status(task_id) or {
            "task_id": task_id,
            "status": "unknown"
        }
        task_data["status"] = status
        task_data["result"] = result
        task_data["completed_at"] = datetime.now().isoformat()

        if self.client:
            try:
                self.client.set(f"zeroharm:task:{task_id}", json.dumps(task_data), ex=3600)
            except Exception as e:
                logger.error(f"Redis save task result failed: {e}")
        else:
            self.local_results[task_id] = task_data

    async def start_worker(self, handlers: Dict[str, Callable[[Dict[str, Any]], Any]], broadcast_callback: Optional[Callable[[Dict[str, Any]], Any]] = None):
        """
        Background daemon loop processing tasks sequentially or concurrently.
        Resolves callbacks and broadcasts completion alerts.
        """
        logger.info("Starting background Compute Task Queue worker...")
        
        while True:
            try:
                task_id = None
                task_data = None

                # 1. Fetch task ID
                if self.client:
                    try:
                        # BLPOP blocks until a task is available (blocking pop)
                        # We use a short timeout to prevent lockups during shutdown
                        res = self.client.blpop("zeroharm:task_queue", timeout=1)
                        if res:
                            task_id = res[1]
                            task_data = self.get_task_status(task_id)
                    except Exception as e:
                        logger.error(f"Redis task dequeue failed: {e}. Sleeping...")
                        await asyncio.sleep(2)
                        continue
                else:
                    try:
                        # Fallback: get from asyncio Queue
                        task_data = await asyncio.wait_for(self.local_queue.get(), timeout=1.0)
                        task_id = task_data["task_id"]
                    except asyncio.TimeoutError:
                        continue

                if not task_data or not task_id:
                    await asyncio.sleep(0.1)
                    continue

                task_type = task_data["task_type"]
                payload = task_data["payload"]

                logger.info(f"Worker dequeued task {task_id} of type: {task_type}")
                self._update_task_result(task_id, "running", None)
                if broadcast_callback:
                    await broadcast_callback({
                        "event": "task_started",
                        "task_id": task_id,
                        "task_type": task_type,
                        "status": "running"
                    })

                # 2. Run handler
                if task_type in handlers:
                    try:
                        # Support both async and sync handler calls
                        handler = handlers[task_type]
                        if asyncio.iscoroutinefunction(handler):
                            result = await handler(payload)
                        else:
                            result = handler(payload)

                        # Save success result
                        self._update_task_result(task_id, "success", result)
                        logger.info(f"Task {task_id} completed successfully.")

                        # Broadcast notification
                        if broadcast_callback:
                            await broadcast_callback({
                                "event": "task_completed",
                                "task_id": task_id,
                                "task_type": task_type,
                                "status": "success",
                                "result": result
                            })

                    except Exception as he:
                        logger.error(f"Handler execution failed for task {task_id}: {he}", exc_info=True)
                        self._update_task_result(task_id, "failed", {"error": str(he)})
                        
                        if broadcast_callback:
                            await broadcast_callback({
                                "event": "task_completed",
                                "task_id": task_id,
                                "task_type": task_type,
                                "status": "failed",
                                "result": {"error": str(he)}
                            })
                else:
                    logger.error(f"No handler registered for task type: {task_type}")
                    self._update_task_result(task_id, "failed", {"error": f"Handler {task_type} not found"})

            except asyncio.CancelledError:
                logger.info("Compute Task Queue worker daemon shutting down...")
                break
            except Exception as e:
                logger.error(f"Error in task queue worker loop: {e}", exc_info=True)
                await asyncio.sleep(1)


# Singleton instance
distributed_task_queue = DistributedTaskQueue()
