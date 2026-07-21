import asyncio
import sys
import os
import logging

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.integration.ingestion_queue import IngestionQueue, TelemetryStreamProcessor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_ingestion_queue")

async def test_stream_processor():
    logger.info("--- Testing TelemetryStreamProcessor (Option B: Stream Windows) ---")
    processor = TelemetryStreamProcessor(window_size=5)
    
    # Simulate gradual CO buildup
    readings = [10.0, 15.0, 22.0, 31.0, 45.0, 48.0, 52.0]
    
    for i, co_val in enumerate(readings):
        gas_readings = {"co_ppm": co_val, "pressure_psi": 100.0, "h2s_ppm": 0.0}
        alerts = processor.process_telemetry("Blast Furnace A", gas_readings)
        
        logger.info(f"Ingested CO: {co_val} ppm | Active Window: {list(processor.windows['Blast Furnace A']['co_ppm'])}")
        
        for alert in alerts:
            logger.info(f"  [STREAM ALERT DETECTED] {alert['event_type']} - {alert['details']}")
            
            # The average threshold for co_ppm is 35.0. 
            # Buildup goes up to 52.0, so we expect a threshold breach.
            # Volatility also increases, so we expect a high variance alert.
            
    assert len(processor.windows["Blast Furnace A"]["co_ppm"]) == 5, "Window size limit failed"
    logger.info("TelemetryStreamProcessor tests completed successfully!\n")


async def test_ingestion_queue():
    logger.info("--- Testing IngestionQueue (Option A: Broker Decoupling) ---")
    queue = IngestionQueue(broker_type="asyncio")
    queue.connect()
    
    processed_events = []
    
    # Callback to simulate background consumer processing
    async def dummy_handler(payload):
        processed_events.append(payload)
        logger.info(f"Consumer processed payload: Task {payload['task_id']} | Event: {payload['event_type']}")
    
    # Start the consumer in the background
    consumer_task = asyncio.create_task(queue.start_consumer(dummy_handler))
    
    # Publish mock events
    task_1 = await queue.publish_event("state_update", {"zone_name": "Sinter Plant", "update": {"gas_readings": {"co_ppm": 12.0}}})
    task_2 = await queue.publish_event("cctv_event", {"zone": "Sinter Plant", "event_type": "no_ppe", "confidence": 0.98})
    
    logger.info(f"Published state_update (Task: {task_1})")
    logger.info(f"Published cctv_event (Task: {task_2})")
    
    # Give the async consumer a moment to process the events
    await asyncio.sleep(0.5)
    
    # Cancel background consumer
    consumer_task.cancel()
    try:
        await consumer_task
    except asyncio.CancelledError:
        pass
        
    assert len(processed_events) >= 2, "Decoupled consumer did not process all events"
    assert processed_events[0]["task_id"] == task_1, "Incorrect task ordering or processing"
    assert processed_events[1]["task_id"] == task_2, "Incorrect task ordering or processing"
    
    logger.info("IngestionQueue tests completed successfully!\n")


async def main():
    logger.info("Starting Ingestion & Stream Processing Unit Tests...")
    try:
        await test_stream_processor()
        await test_ingestion_queue()
        logger.info("ALL TESTS PASSED SUCCESSFULLY!")
    except AssertionError as e:
        logger.error(f"TEST ASSERTION FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"An unexpected error occurred during testing: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
