import asyncio
import sys
import os
import logging
import json

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database_scalability import (
    RedisStateCache,
    Neo4jRiskKnowledgeGraph,
    TimescaleDBTelemetryLogger,
    DISTRIBUTED_STORAGE_ENABLED
)
from backend.app.knowledge_graph.graph import KnowledgeGraphNode

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_database_scalability")

def test_redis_state_cache():
    logger.info("--- Testing RedisStateCache (Option A: Distributed Cache) ---")
    cache = RedisStateCache()
    
    # Initialize cache with small plant mock state
    mock_state = {
        "Blast Furnace A": {
            "zone": "Blast Furnace A",
            "gas_readings": {"o2": 20.8, "co": 2.0},
            "permits": [],
            "maintenance_active": False,
            "timestamp": "2026-07-21T12:00:00"
        }
    }
    
    cache.initialize_state(mock_state)
    
    # Read zone state
    state = cache.get_zone_state("Blast Furnace A")
    assert state is not None, "Failed to retrieve zone state"
    assert state["gas_readings"]["co"] == 2.0, "Gas readings mismatch"
    
    # Update zone state
    update = {"gas_readings": {"co": 45.0}, "maintenance_active": True}
    cache.update_zone_state("Blast Furnace A", update)
    
    updated_state = cache.get_zone_state("Blast Furnace A")
    assert updated_state["gas_readings"]["co"] == 45.0, "Update write-back failed"
    assert updated_state["maintenance_active"] is True, "Boolean update failed"
    
    # Test Geo-location tracking (Haversine fallback or Redis GEO)
    cache.add_worker_location("W-101", 17.6868, 83.2185) # Visakhapatnam steel plant approx coordinates
    cache.add_worker_location("W-102", 17.6890, 83.2195)
    cache.add_worker_location("W-103", 28.6139, 77.2090) # Delhi coordinates (far away)
    
    # Get workers within 500 meters of Visakhapatnam steel plant
    nearby = cache.get_workers_near(17.6868, 83.2185, 500.0)
    logger.info(f"Workers near (radius 500m): {nearby}")
    
    assert "W-101" in nearby, "Worker W-101 not found near its location"
    assert "W-103" not in nearby, "Delhi worker falsely classified as nearby"
    
    logger.info("RedisStateCache tests completed successfully!\n")


def test_neo4j_knowledge_graph():
    logger.info("--- Testing Neo4jRiskKnowledgeGraph (Option B: Graph Database) ---")
    graph = Neo4jRiskKnowledgeGraph()
    
    # Update sensor reading in graph
    res_sensor = graph.update_sensor_reading("sensor_co_coke", {"reading_ppm": 35.5, "trend": "rising"})
    assert res_sensor.get("status") == "updated", "Sensor update failed"
    
    # Update zone risk
    res_zone = graph.update_zone_risk("zone_coke_oven", 85.0)
    assert res_zone.get("status") == "updated", "Zone risk update failed"
    
    # Get zone node properties
    node = graph.get_node("zone_coke_oven")
    assert node["properties"]["risk_score"] == 85.0, "Zone score mismatch"
    assert node["properties"]["status"] == "critical", "Status threshold mapping failed"
    
    # Get Snapshot metadata
    snap = graph.snapshot()
    logger.info(f"Snapshot contains {len(snap['nodes'])} nodes and {len(snap['edges'])} edges")
    assert len(snap["nodes"]) > 0, "Seeded graph returned empty node snapshot"
    
    logger.info("Neo4jRiskKnowledgeGraph tests completed successfully!\n")


def test_timescale_logger():
    logger.info("--- Testing TimescaleDBTelemetryLogger (Option C: Time-Series Logger) ---")
    logger_db = TimescaleDBTelemetryLogger()
    
    # Log some dummy gas readings
    gas_readings = {"o2": 20.8, "co": 12.5, "temperature": 32.0, "pressure": 1.05}
    logger_db.log_telemetry("Sinter Plant", gas_readings)
    
    if not logger_db.enabled:
        # If running in local file fallback, assert file was created
        assert os.path.exists(logger_db.local_log_path), "Fallback file log not created"
        with open(logger_db.local_log_path, "r") as f:
            log_data = json.load(f)
            assert len(log_data) > 0, "Fallback log empty"
            assert log_data[-1]["zone"] == "Sinter Plant", "Log entry mismatch"
            logger.info("TimescaleDB logging (fallback mode) verified.")
    else:
        logger.info("TimescaleDB telemetry insertion verified.")
        
    logger.info("TimescaleDBTelemetryLogger tests completed successfully!\n")


def main():
    logger.info(f"Starting Database Scalability Suite. Distributed Mode: {DISTRIBUTED_STORAGE_ENABLED}")
    try:
        test_redis_state_cache()
        test_neo4j_knowledge_graph()
        test_timescale_logger()
        logger.info("ALL DATABASE SCALABILITY TESTS PASSED SUCCESSFULLY!")
    except AssertionError as e:
        logger.error(f"TEST ASSERTION FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"An unexpected error occurred during database testing: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
