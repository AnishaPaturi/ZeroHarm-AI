import os
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

logger = logging.getLogger("zeroharm_ai.database_scalability")

# Try imports for scalability components
try:
    import redis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False

try:
    from neo4j import GraphDatabase
    HAS_NEO4J = True
except ImportError:
    HAS_NEO4J = False

try:
    import psycopg2
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

from .knowledge_graph.graph import RiskKnowledgeGraph

# Global scalability configuration
DISTRIBUTED_STORAGE_ENABLED = os.getenv("DISTRIBUTED_STORAGE_ENABLED", "false").lower() == "true"


# ==============================================================================
# 1. OPTION A: Distributed Cache (Redis) & Geospatial Worker Tracking
# ==============================================================================
class RedisStateCache:
    """
    Implements Option A: Distributed Cache (Redis).
    Manages active plant zone telemetry states and worker geospatial coordinates.
    Falls back to in-memory storage if Redis is disabled or offline.
    """
    def __init__(self):
        self.enabled = DISTRIBUTED_STORAGE_ENABLED and HAS_REDIS
        self.host = os.getenv("REDIS_HOST", "localhost")
        self.port = int(os.getenv("REDIS_PORT", 6379))
        self.password = os.getenv("REDIS_PASSWORD", None)
        self.client = None
        self.local_state: Dict[str, Dict[str, Any]] = {}
        self.local_worker_locations: Dict[str, Tuple[float, float]] = {}

        if self.enabled:
            try:
                self.client = redis.Redis(
                    host=self.host,
                    port=self.port,
                    password=self.password,
                    decode_responses=True,
                    socket_timeout=2.0
                )
                self.client.ping()
                logger.info("Successfully connected to Redis active state cache.")
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {e}. Falling back to local state.")
                self.enabled = False

    def initialize_state(self, initial_state: Dict[str, Dict[str, Any]]):
        """Seeds the state dictionary into Redis or local memory."""
        if self.enabled:
            try:
                for zone, state in initial_state.items():
                    # Save each zone state under a Redis key
                    self.client.set(f"zeroharm:zone:{zone}", json.dumps(state))
                logger.info("Redis cache successfully seeded with default plant state.")
            except Exception as e:
                logger.error(f"Error seeding Redis: {e}")
        else:
            self.local_state = initial_state.copy()

    def get_zone_state(self, zone_name: str) -> Optional[Dict[str, Any]]:
        """Fetches the state of a single zone."""
        if self.enabled:
            try:
                raw = self.client.get(f"zeroharm:zone:{zone_name}")
                if raw:
                    return json.loads(raw)
            except Exception as e:
                logger.error(f"Error reading zone state from Redis: {e}")
        return self.local_state.get(zone_name)

    def get_all_states(self) -> Dict[str, Dict[str, Any]]:
        """Returns the full plant state dictionary."""
        if self.enabled:
            try:
                keys = self.client.keys("zeroharm:zone:*")
                states = {}
                for key in keys:
                    zone_name = key.replace("zeroharm:zone:", "")
                    raw = self.client.get(key)
                    if raw:
                        states[zone_name] = json.loads(raw)
                return states
            except Exception as e:
                logger.error(f"Error reading all states from Redis: {e}")
        return self.local_state

    def update_zone_state(self, zone_name: str, update: Dict[str, Any]) -> Dict[str, Any]:
        """Updates the state of a specific zone."""
        current = self.get_zone_state(zone_name) or {}
        
        # Apply updates
        if "gas_readings" in update:
            current.setdefault("gas_readings", {}).update(update["gas_readings"])
        if "permits" in update:
            current["permits"] = update["permits"]
        for key in ["maintenance_active", "shift_changeover_active", "cctv_alerts", "restricted_entry_count", "restricted_entry_history"]:
            if key in update:
                current[key] = update[key]
                
        current["timestamp"] = datetime.now().isoformat()

        if self.enabled:
            try:
                self.client.set(f"zeroharm:zone:{zone_name}", json.dumps(current))
            except Exception as e:
                logger.error(f"Error writing update to Redis: {e}")
        else:
            self.local_state[zone_name] = current
            
        return current

    def update_zone_state_direct(self, zone_name: str, state: Dict[str, Any]):
        """Directly writes/replaces a zone state dict in Redis or local memory."""
        if self.enabled:
            try:
                self.client.set(f"zeroharm:zone:{zone_name}", json.dumps(state))
            except Exception as e:
                logger.error(f"Error writing direct state to Redis: {e}")
        else:
            self.local_state[zone_name] = state

    # --- Geospatial Worker Location (GEOADD / GEORADIUS equivalent) ---
    def add_worker_location(self, worker_id: str, lat: float, lon: float):
        """Stores a worker's latitude and longitude coordinates."""
        if self.enabled:
            try:
                # GEOADD uses (longitude, latitude, member)
                self.client.geoadd("zeroharm:workers:locations", (lon, lat, worker_id))
            except Exception as e:
                logger.error(f"Redis GEOADD failed: {e}")
        else:
            self.local_worker_locations[worker_id] = (lat, lon)

    def get_workers_near(self, lat: float, lon: float, radius_meters: float) -> List[str]:
        """Queries for workers within a specific radius of a central point."""
        if self.enabled:
            try:
                # GEORADIUS returns members within radius
                results = self.client.georadius(
                    "zeroharm:workers:locations",
                    lon, lat,
                    radius_meters,
                    unit="m"
                )
                return results or []
            except Exception as e:
                logger.error(f"Redis GEORADIUS failed: {e}")
        
        # Fallback haversine check in local memory
        import math
        nearby = []
        for wid, (w_lat, w_lon) in self.local_worker_locations.items():
            # Simple distance approximation
            d_lat = math.radians(w_lat - lat)
            d_lon = math.radians(w_lon - lon)
            a = math.sin(d_lat/2)**2 + math.cos(math.radians(lat)) * math.cos(math.radians(w_lat)) * math.sin(d_lon/2)**2
            c = 2 * math.asin(math.sqrt(a))
            dist_meters = 6371000 * c
            if dist_meters <= radius_meters:
                nearby.append(wid)
        return nearby


# ==============================================================================
# 2. OPTION B: Neo4j Risk Knowledge Graph
# ==============================================================================
class Neo4jRiskKnowledgeGraph(RiskKnowledgeGraph):
    """
    Implements Option B: Real Graph Database (Neo4j / AWS Neptune).
    Replicates RiskKnowledgeGraph, syncing updates to a Neo4j cluster when enabled.
    Falls back to a standard NetworkX in-memory Graph if Neo4j is offline.
    """
    def __init__(self):
        super().__init__()
        self.enabled = DISTRIBUTED_STORAGE_ENABLED and HAS_NEO4J
        self.uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.user = os.getenv("NEO4J_USER", "neo4j")
        self.password = os.getenv("NEO4J_PASSWORD", "password")
        self.driver = None

        if self.enabled:
            try:
                self.driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
                # Test connectivity
                with self.driver.session() as session:
                    session.run("RETURN 1")
                logger.info("Successfully connected to Neo4j Graph Database.")
                self._sync_networkx_to_neo4j()
            except Exception as e:
                logger.error(f"Failed to connect to Neo4j: {e}. Running local Graph only.")
                self.enabled = False

    def close(self):
        if self.driver:
            self.driver.close()

    def _sync_networkx_to_neo4j(self):
        """Syncs all nodes and relations from the seeded NetworkX graph to Neo4j."""
        try:
            with self.driver.session() as session:
                session.run("MATCH (n) DETACH DELETE n")
                
                # Insert nodes
                for nid in self.graph.nodes:
                    node_data = self.graph.nodes[nid]
                    node_type = node_data.get("node_type", "Entity")
                    props = node_data.get("properties", {})
                    cypher = f"CREATE (n:{node_type} {{id: $node_id, created_at: $now, updated_at: $now}}) SET n += $props"
                    session.run(cypher, node_id=nid, props=props, now=datetime.now().isoformat())
                
                # Insert relationships
                for u, v, d in self.graph.edges(data=True):
                    rel_type = d.get("relation_type", "ConnectedTo")
                    props = d.get("properties", {})
                    cypher = f"MATCH (a {{id: $src}}), (b {{id: $dest}}) CREATE (a)-[r:{rel_type} {{created_at: $now}}]->(b) SET r += $props"
                    session.run(cypher, src=u, dest=v, props=props, now=datetime.now().isoformat())
                logger.info("Seeded Neo4j successfully from NetworkX ontology model.")
        except Exception as e:
            logger.error(f"Error syncing NetworkX to Neo4j: {e}")

    def add_node(self, node):
        res = super().add_node(node)
        if self.enabled:
            try:
                with self.driver.session() as session:
                    cypher = f"MERGE (n:{node.node_type} {{id: $id}}) SET n.updated_at = $now, n += $props"
                    session.run(cypher, id=node.node_id, props=node.properties, now=datetime.now().isoformat())
            except Exception as e:
                logger.error(f"Failed to sync node add to Neo4j: {e}")
        return res

    def add_relation(self, rel):
        res = super().add_relation(rel)
        if self.enabled:
            try:
                with self.driver.session() as session:
                    cypher = f"MATCH (a {{id: $src}}), (b {{id: $dest}}) MERGE (a)-[r:{rel.relation_type}]->(b) SET r += $props"
                    session.run(cypher, src=rel.source_id, dest=rel.target_id, props=rel.properties)
            except Exception as e:
                logger.error(f"Failed to sync relation add to Neo4j: {e}")
        return res

    def update_sensor_reading(self, sensor_node_id, reading):
        res = super().update_sensor_reading(sensor_node_id, reading)
        if self.enabled:
            try:
                with self.driver.session() as session:
                    cypher = "MATCH (n {id: $id}) SET n += $props, n.updated_at = $now"
                    session.run(cypher, id=sensor_node_id, props=reading, now=datetime.now().isoformat())
            except Exception as e:
                logger.error(f"Failed to sync sensor reading update to Neo4j: {e}")
        return res

    def update_zone_risk(self, zone_node_id, risk_score):
        res = super().update_zone_risk(zone_node_id, risk_score)
        status = "critical" if risk_score >= 75 else "warning" if risk_score >= 40 else "normal"
        if self.enabled:
            try:
                with self.driver.session() as session:
                    cypher = "MATCH (n {id: $id}) SET n.risk_score = $score, n.status = $status, n.updated_at = $now"
                    session.run(cypher, id=zone_node_id, score=risk_score, status=status, now=datetime.now().isoformat())
            except Exception as e:
                logger.error(f"Failed to sync zone risk update to Neo4j: {e}")
        return res


# ==============================================================================
# 3. OPTION C: Time-Series Database (TimescaleDB / InfluxDB equivalent)
# ==============================================================================
class TimescaleDBTelemetryLogger:
    """
    Implements Option C: Time-Series Database (TimescaleDB / InfluxDB).
    Logs chronological sensor telemetry data points to a PostgreSQL/TimescaleDB tablespace.
    Falls back to a local JSON log file if database settings are offline.
    """
    def __init__(self):
        self.enabled = DISTRIBUTED_STORAGE_ENABLED and HAS_PSYCOPG2
        self.host = os.getenv("TIMESCALE_HOST", "localhost")
        self.port = int(os.getenv("TIMESCALE_PORT", 5432))
        self.user = os.getenv("TIMESCALE_USER", "postgres")
        self.password = os.getenv("TIMESCALE_PASSWORD", "password")
        self.db_name = os.getenv("TIMESCALE_DB", "zeroharm_telemetry")
        
        self.local_log_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "data", "telemetry_history.json"
        )
        os.makedirs(os.path.dirname(self.local_log_path), exist_ok=True)

        if self.enabled:
            try:
                self.conn = psycopg2.connect(
                    host=self.host,
                    port=self.port,
                    user=self.user,
                    password=self.password,
                    dbname=self.db_name,
                    connect_timeout=2
                )
                self.conn.autocommit = True
                self._setup_timescale_hypertables()
                logger.info("Successfully connected to TimescaleDB telemetry logger.")
            except Exception as e:
                logger.error(f"Failed to connect to TimescaleDB: {e}. Logging to local JSON file instead.")
                self.enabled = False

    def _setup_timescale_hypertables(self):
        """Creates the telemetry tables and registers them as TimescaleDB Hypertables."""
        with self.conn.cursor() as cursor:
            # Create metrics log table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS telemetry_history (
                    time TIMESTAMPTZ NOT NULL,
                    zone VARCHAR(100) NOT NULL,
                    o2 NUMERIC,
                    co NUMERIC,
                    ch4 NUMERIC,
                    h2s NUMERIC,
                    temperature NUMERIC,
                    pressure NUMERIC
                );
            """)
            
            # Check if it is a hypertable, if not, convert it (TimescaleDB command)
            try:
                cursor.execute("SELECT create_hypertable('telemetry_history', 'time', if_not_exists => TRUE);")
            except Exception:
                # Fallback: ignore if not running on TimescaleDB extension (plain Postgres)
                pass

    def log_telemetry(self, zone_name: str, gas_readings: Dict[str, Any]):
        """Logs sensor telemetry values to database or local JSON file."""
        now = datetime.now().isoformat()
        
        o2 = gas_readings.get("o2", gas_readings.get("reading_pct", None))
        co = gas_readings.get("co", gas_readings.get("reading_ppm", None))
        ch4 = gas_readings.get("ch4_lfl", None)
        h2s = gas_readings.get("h2s", None)
        temp = gas_readings.get("temperature", None)
        pres = gas_readings.get("pressure", None)

        if self.enabled:
            try:
                with self.conn.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO telemetry_history (time, zone, o2, co, ch4, h2s, temperature, pressure)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (now, zone_name, o2, co, ch4, h2s, temp, pres)
                    )
                return
            except Exception as e:
                logger.error(f"TimescaleDB write failed: {e}. Falling back to file log.")
                
        # Local JSON write fallback
        log_entry = {
            "timestamp": now,
            "zone": zone_name,
            "o2": o2,
            "co": co,
            "ch4": ch4,
            "h2s": h2s,
            "temperature": temp,
            "pressure": pres
        }
        try:
            history = []
            if os.path.exists(self.local_log_path):
                with open(self.local_log_path, "r") as f:
                    content = f.read().strip()
                    if content:
                        history = json.loads(content)
            
            history.append(log_entry)
            
            # Limit file log to last 500 records
            if len(history) > 500:
                history.pop(0)

            with open(self.local_log_path, "w") as f:
                json.dump(history, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to write local telemetry log: {e}")


# Singleton instances for imports
redis_state_cache = RedisStateCache()
timescale_telemetry_logger = TimescaleDBTelemetryLogger()
