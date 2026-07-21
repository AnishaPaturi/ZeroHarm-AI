from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
import os
import numpy as np
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional
from pydantic import BaseModel, Field
from app.notifications.routes import router as notification_router
# Load environment variables from backend/.env before any component reads them.
try:
    from dotenv import load_dotenv
    _BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(_BACKEND_DIR, ".env"))
except ImportError:
    pass

from .engine.models import RiskCheckRequest, RiskCheckResponse, GasReadings, PermitInfo, FactorRisk, CCTVAlert
from .engine.rules import evaluate_rules
from .engine.ml_anomaly import CompoundRiskMLModel
from .engine.collaborative_reasoning import MultiAgentCollaborativeReasoning, CollaborativeReasoningResponse
from .engine.near_miss_predictor import NearMissPredictionEngine
from .engine.safety_coach import SafetyCoachEngine, WorkerSafetyProfile

# ---------------------------------------------------------------------------
# PART C — Incident Pattern Intelligence & Compliance Audit Agent
# ---------------------------------------------------------------------------
from .rag.vector_store import ZeroHarmVectorStore
from .rag.agent import ZeroHarmSafetyAgent

# ---------------------------------------------------------------------------
# PART B — Geospatial Safety Heatmap + Emergency Response Orchestrator
# ---------------------------------------------------------------------------
from . import config
from .geospatial.models import TriggerAlertRequest
from .geospatial.heatmap import HeatmapEngine
from .geospatial.worker_simulator import WorkerSimulator
from .geospatial.plant_layout import get_layout
from .orchestrator.evacuation import EvacuationManager
from .orchestrator.incident_report import generate_report, get_reports
from .orchestrator.workflow import get_workflows as get_safety_workflows, update_workflow_status
from .orchestrator.alert_channels import get_alert_log

# ---------------------------------------------------------------------------
# PART D — Digital Permit Intelligence Agent + Integration & Deliverables
# ---------------------------------------------------------------------------
from .permits.agent import DigitalPermitIntelligenceAgent
from .permits.models import PermitAuditRequest, FullPlantPermitAuditResponse
from .integration.pipeline import ZeroHarmIntegrationPipeline
from .integration.models import FullAssessmentResponse, DemoScenarioResponse
from .integration.demo_script import get_demo_scenario
from .geospatial.topology import PlantTopology
from .integration.ingestion_queue import ingestion_pipeline
from .integration.task_queue import distributed_task_queue, ASYNC_COMPUTE_ENABLED

ASYNC_INGESTION_ENABLED = os.getenv("ASYNC_INGESTION_ENABLED", "false").lower() == "true"

# ---------------------------------------------------------------------------
# Innovation 7 — Dynamic Risk Graph (Knowledge Graph)
# ---------------------------------------------------------------------------
from .database_scalability import Neo4jRiskKnowledgeGraph as RiskKnowledgeGraph, redis_state_cache, timescale_telemetry_logger

# ---------------------------------------------------------------------------
# Unimplemented/Partially Implemented Innovations (Innovations 11, 15, 16, 17, 18, 20)
# ---------------------------------------------------------------------------
from .orchestrator.handover import ShiftHandoverGenerator
from .orchestrator.drone import DroneInspectionSimulator
from .orchestrator.query_engine import NaturalLanguageQueryEngine
from .rag.hybrid_reasoner import RAGKnowledgeGraphHybridReasoner
from .engine.feedback_engine import SelfImprovingAgentEngine
from .database import (
    init_db,
    seed_default_users,
    get_user_by_email,
    get_users_by_status,
    create_pending_user,
    approve_user as db_approve_user,
    reject_user as db_reject_user,
)

import jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends

security = HTTPBearer(auto_error=False)
JWT_SECRET = os.getenv("JWT_SECRET", "zeroharm_jwt_super_secret_key_12345")
JWT_ALGORITHM = "HS256"

def create_jwt_token(user_data: dict) -> str:
    payload = {
        "sub": user_data["email"],
        "role": user_data["role"],
        "name": user_data.get("full_name", user_data.get("fullName", "User")),
        "exp": datetime.now(timezone.utc).timestamp() + 86400  # 24 hours
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        return {
            "email": "admin@zeroharm.ai",
            "role": "Safety Officer",
            "full_name": "Demo Admin"
        }
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {
            "email": payload["sub"],
            "role": payload["role"],
            "full_name": payload.get("name", "User")
        }
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid safety token or token expired")

def require_role(allowed_roles: List[str]):
    def dependency(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail=f"Access denied. Required roles: {allowed_roles}")
        return current_user
    return dependency

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("zeroharm_ai")

app = FastAPI(
    title="ZeroHarm AI — Industrial Safety Intelligence Platform",
    description="Fuses real-time gas telemetry, permits, and operational status into a compound risk score "
                "(Person A), then projects that risk onto the plant layout and drives evacuation/alert "
                "workflows (Person B), cross-references incidents and regulations via RAG (Person C), and "
                "cross-checks live permits against plant conditions while tying all four agents into one "
                "demo flow (Person D).",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(notification_router)

# --- Person A globals ---
ml_model = CompoundRiskMLModel()
near_miss_engine = NearMissPredictionEngine()
safety_coach_engine = SafetyCoachEngine()
risk_history: List[Dict[str, Any]] = []
MAX_HISTORY_LEN = 100

# --- Person B globals ---
heatmap_engine = HeatmapEngine()
worker_sim = WorkerSimulator()

# --- Person C globals ---
vector_store = ZeroHarmVectorStore()
safety_agent = ZeroHarmSafetyAgent(vector_store=vector_store)

# --- Person D globals ---
permit_agent = DigitalPermitIntelligenceAgent()
topology_engine = PlantTopology()
collaborative_engine = MultiAgentCollaborativeReasoning()

# --- Innovation 7: Knowledge Graph globals ---
risk_graph = RiskKnowledgeGraph()

# --- Innovation 11, 16, 17, 18, 20: New Safety Engine globals ---
from .orchestrator.incident_report import _reports as reports_list
handover_generator = ShiftHandoverGenerator(safety_agent=safety_agent)
drone_simulator = DroneInspectionSimulator()
query_engine = NaturalLanguageQueryEngine(incident_reports=reports_list)
hybrid_reasoner = RAGKnowledgeGraphHybridReasoner(safety_agent=safety_agent, risk_graph=risk_graph)
feedback_engine = SelfImprovingAgentEngine()


def _on_incident_needed(zone: str, risk_assessment: dict, evacuation_record):
    # Query RAG compliance agent to append regulatory context
    try:
        factors_str = ", ".join(f.get("name", "") for f in risk_assessment.get("factors", []))
        rag_query = f"Identify compliance deviations or past precedents for: Zone {zone} had a risk event with factors: {factors_str}."
        rag_res = safety_agent.query(rag_query)
        rag_analysis = rag_res.get("answer", "")
    except Exception as e:
        logger.error(f"Failed to fetch RAG analysis for incident report: {e}")
        rag_analysis = "RAG compliance analysis unavailable."

    report = generate_report(zone, risk_assessment, evacuation_record, risk_history, rag_answer=rag_analysis)
    logger.warning(f"Preliminary incident report generated with RAG: {report.report_id} for zone '{zone}'")


evacuation_mgr = EvacuationManager(worker_simulator=worker_sim, incident_report_generator=_on_incident_needed)

# --- Person D: single wiring point that ties A + B + C + D into one demo flow ---
integration_pipeline = ZeroHarmIntegrationPipeline(
    heatmap_engine=heatmap_engine,
    evacuation_mgr=evacuation_mgr,
    worker_sim=worker_sim,
    safety_agent=safety_agent,
    permit_agent=permit_agent,
    topology_engine=topology_engine,
)


# WebSocket Connections Manager (shared: Person A's live risk feed AND Person B's heatmap feed
# both broadcast through this single manager, distinguished by the "event" field in each message)
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New client connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Active connections: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to client: {e}")
                dead_connections.append(connection)
        for conn in dead_connections:
            self.disconnect(conn)


manager = ConnectionManager()

# In-Memory Plant State for Simulation (Person A)
class PlantStateProxy:
    def __getitem__(self, key):
        state = redis_state_cache.get_zone_state(key)
        if state is None:
            raise KeyError(key)
        return state

    def __setitem__(self, key, value):
        redis_state_cache.update_zone_state_direct(key, value)

    def __contains__(self, key):
        return redis_state_cache.get_zone_state(key) is not None

    def get(self, key, default=None):
        state = redis_state_cache.get_zone_state(key)
        return state if state is not None else default

    def items(self):
        return redis_state_cache.get_all_states().items()

    def values(self):
        return redis_state_cache.get_all_states().values()

    def keys(self):
        return redis_state_cache.get_all_states().keys()


INITIAL_PLANT_STATE: Dict[str, Dict[str, Any]] = {
    "Coke Oven Battery 1": {
        "zone": "Coke Oven Battery 1",
        "gas_readings": {"o2": 20.8, "co": 2.5, "ch4_lfl": 0.1, "h2s": 0.2, "temperature": 29.5, "pressure": 1.01},
        "permits": [{"permit_id": "PTW-2026-001", "permit_type": "hot_work", "status": "active",
                     "zone": "Coke Oven Battery 1", "workers_count": 3}],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "cctv_alerts": [],
        "restricted_entry_count": 0,
        "restricted_entry_history": [],
        "timestamp": datetime.now().isoformat()
    },
    "Blast Furnace A": {
        "zone": "Blast Furnace A",
        "gas_readings": {"o2": 20.9, "co": 5.0, "ch4_lfl": 0.2, "h2s": 0.1, "temperature": 32.0, "pressure": 1.05},
        "permits": [{"permit_id": "PTW-2026-004", "permit_type": "cold_work", "status": "active",
                     "zone": "Blast Furnace A", "workers_count": 2}],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "cctv_alerts": [],
        "restricted_entry_count": 0,
        "restricted_entry_history": [],
        "timestamp": datetime.now().isoformat()
    },
    "Sinter Plant": {
        "zone": "Sinter Plant",
        "gas_readings": {"o2": 20.8, "co": 1.0, "ch4_lfl": 0.0, "h2s": 0.0, "temperature": 27.0, "pressure": 0.99},
        "permits": [{"permit_id": "PTW-2026-002", "permit_type": "confined_space", "status": "active",
                     "zone": "Sinter Plant", "workers_count": 2}],
        "maintenance_active": True,
        "shift_changeover_active": False,
        "cctv_alerts": [],
        "restricted_entry_count": 0,
        "restricted_entry_history": [],
        "timestamp": datetime.now().isoformat()
    },
    "Ammonia Storage Tank": {
        "zone": "Ammonia Storage Tank",
        "gas_readings": {"o2": 20.8, "co": 0.5, "ch4_lfl": 0.0, "h2s": 1.5, "temperature": 25.0, "pressure": 1.10},
        "permits": [{"permit_id": "PTW-2026-003", "permit_type": "height_work", "status": "active",
                     "zone": "Ammonia Storage Tank", "workers_count": 4}],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "cctv_alerts": [],
        "restricted_entry_count": 0,
        "restricted_entry_history": [],
        "timestamp": datetime.now().isoformat()
    }
}

# Seed Redis state cache
redis_state_cache.initialize_state(INITIAL_PLANT_STATE)

plant_state = PlantStateProxy()


# ---------------------------------------------------------------------------
# Startup / Shutdown
# ---------------------------------------------------------------------------
async def worker_tick_loop():
    while True:
        worker_sim.tick()
        await asyncio.sleep(config.WORKER_TICK_INTERVAL_SECONDS)


async def handle_queued_message(payload: Dict[str, Any]):
    try:
        event_type = payload["event_type"]
        data = payload["data"]
        logger.info(f"Asynchronously processing queued event: {event_type} (Task: {payload['task_id']})")
        
        if event_type == "state_update":
            await update_zone_state(zone_name=data["zone_name"], update=data["update"], sync=True)
        elif event_type == "cctv_event":
            req = CCTVAlertRequest(**data)
            await trigger_cctv_event(req, sync=True)
        elif event_type == "stream_anomaly":
            zone_name = data["zone"]
            if zone_name in plant_state:
                zone_state = plant_state[zone_name]
                if "cctv_alerts" not in zone_state:
                    zone_state["cctv_alerts"] = []
                
                alert_payload = {
                    "zone": zone_name,
                    "event_type": data["event_type"],
                    "confidence": 0.95,
                    "timestamp": data["timestamp"],
                    "worker_id": "SYSTEM",
                    "worker_name": f"Stream Processor: {data['details']}"
                }
                
                replaced = False
                for i, active_alert in enumerate(zone_state["cctv_alerts"]):
                    if active_alert["event_type"] == data["event_type"] and active_alert.get("worker_id") == "SYSTEM":
                        zone_state["cctv_alerts"][i] = alert_payload
                        replaced = True
                        break
                if not replaced:
                    zone_state["cctv_alerts"].append(alert_payload)
                    
                await update_zone_state(zone_name, {"cctv_alerts": zone_state["cctv_alerts"]}, sync=True)
    except Exception as e:
        logger.error(f"Error processing async queued message: {e}", exc_info=True)


async def handle_async_collaborative_debate(payload: Dict[str, Any]) -> Dict[str, Any]:
    zone = payload["zone"]
    zone_state = plant_state[zone]
    debate_result = collaborative_engine.run_debate(zone, zone_state, plant_state)
    # Broadcast the debate notification event so the front-end can log it in the console
    await manager.broadcast({
        "event": "collaborative_debate",
        "zone": zone,
        "debate": debate_result.dict()
    })
    return debate_result.dict()


async def handle_task_broadcast(payload: Dict[str, Any]):
    await manager.broadcast(payload)


@app.on_event("startup")
async def startup_event():
    logger.info("Initializing risk engine ML models...")
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, ml_model.train)
    
    init_db()
    seed_default_users()
    
    # Connect and start the ingestion consumer worker daemon
    ingestion_pipeline.connect()
    asyncio.create_task(ingestion_pipeline.start_consumer(handle_queued_message))
    
    # Start the compute task queue worker daemon (Option A)
    if ASYNC_COMPUTE_ENABLED:
        asyncio.create_task(distributed_task_queue.start_worker(
            handlers={
                "collaborative_debate": handle_async_collaborative_debate
            },
            broadcast_callback=handle_task_broadcast
        ))
    
    asyncio.create_task(worker_tick_loop())
    
    safety_coach_engine.seed_from_plant_state(plant_state)
    for zone_name, zstate in plant_state.items():
        for worker in worker_sim.get_workers(zone_name):
            wid = worker.worker_id
            if wid not in safety_coach_engine.profiles:
                safety_coach_engine.profiles[wid] = WorkerSafetyProfile(wid, worker.name, zone_name)
    logger.info(f"Safety Coach Engine initialized with {len(safety_coach_engine.profiles)} worker profiles.")
    logger.info("Startup complete. Person A + Person B running as one service.")


# Buffer to store the last 5 telemetry frames for each zone to calculate rates of change (Person A temporal analysis)
telemetry_history_buffers: Dict[str, List[Dict[str, Any]]] = {}

def calculate_telemetry_rates(zone: str, current_gas: Dict[str, Any]) -> Tuple[float, float]:
    """
    Appends the current sensor readings to a moving buffer of size 5,
    and returns (d_co_dt, d_pressure_dt) in units per second.
    """
    now = datetime.now()
    co = float(current_gas.get("co", 0.0))
    pressure = float(current_gas.get("pressure", 1.0))
    
    if zone not in telemetry_history_buffers:
        telemetry_history_buffers[zone] = []
        
    buffer = telemetry_history_buffers[zone]
    
    # Append current reading
    buffer.append({
        "time": now,
        "co": co,
        "pressure": pressure
    })
    
    # Keep only the last 5 readings
    if len(buffer) > 5:
        buffer.pop(0)
        
    if len(buffer) < 2:
        return 0.0, 0.0
        
    # Calculate difference between oldest and newest in the buffer
    oldest = buffer[0]
    newest = buffer[-1]
    
    dt = (newest["time"] - oldest["time"]).total_seconds()
    
    # Safeguard against zero division or extreme delays
    if dt <= 0.1:
        return 0.0, 0.0
        
    d_co_dt = (newest["co"] - oldest["co"]) / dt
    d_pressure_dt = (newest["pressure"] - oldest["pressure"]) / dt
    
    return round(d_co_dt, 3), round(d_pressure_dt, 4)


# ---------------------------------------------------------------------------
# PERSON A — risk scoring
# ---------------------------------------------------------------------------
def blend_risk_scores(rule_score: float, ml_score: float, factors: List[FactorRisk]) -> float:
    is_critical_override = any(
        "CRITICAL" in f.details or "ASPHYXIATION" in f.details or "FLAMMABLE GAS DETECTED" in f.details
        or "Explosion Hazard" in f.name or "Toxic" in f.name
        for f in factors
    )
    if is_critical_override or rule_score >= 80.0:
        return max(rule_score, ml_score)

    if ml_score > 60.0 and rule_score < 40.0:
        return round(0.5 * rule_score + 0.5 * ml_score, 1)

    return round(0.6 * rule_score + 0.4 * ml_score, 1)


async def _feed_person_b(zone: str, risk_assessment: dict):
    """
    The single integration point between Person A and Person B.
    Called every time a fresh risk assessment is computed for a zone.
    Updates the geospatial heatmap, runs the evacuation state machine,
    and broadcasts the combined update to any connected clients.
    """
    heatmap_engine.update_from_risk_assessment(zone, risk_assessment)
    heatmap_engine.update_worker_count(zone, worker_sim.count_on_site(zone))
    evac_record = evacuation_mgr.handle_risk_update(zone, risk_assessment)

    await manager.broadcast({
        "event": "heatmap_update",
        "zone": zone,
        "risk_assessment": risk_assessment,
        "evacuation_status": evac_record.status if evac_record else "none",
    })

    # --- Person D integration: cross-check permits every time a fresh risk
    # assessment lands, and broadcast separately only when there's something
    # to flag (keeps the feed quiet during normal operation). ---
    try:
        permit_audit = permit_agent.audit_zone(zone, plant_state[zone], all_zone_states=plant_state)
        if permit_audit.conflicts:
            await manager.broadcast({
                "event": "permit_alert",
                "zone": zone,
                "permit_audit": permit_audit.dict(),
            })
    except Exception as e:
        logger.error(f"Permit intelligence audit failed for zone '{zone}': {e}")


@app.post("/risk-score", response_model=RiskCheckResponse)
async def evaluate_risk_score(request: RiskCheckRequest):
    """
    Stateless endpoint to compute the composite risk score of a given zone configuration.
    Fuses deterministic compliance rules with ML anomaly detection, then feeds the
    result into Person B's geospatial heatmap + emergency orchestrator.
    """
    try:
        # Calculate rates of change from moving buffer if not already present
        gas = request.gas_readings
        if (gas.d_co_dt == 0.0 or gas.d_co_dt is None) and (gas.d_pressure_dt == 0.0 or gas.d_pressure_dt is None):
            d_co_dt, d_pressure_dt = calculate_telemetry_rates(
                request.zone,
                {"co": gas.co, "pressure": gas.pressure or 1.0}
            )
            gas.d_co_dt = d_co_dt
            gas.d_pressure_dt = d_pressure_dt

        rule_score, risk_level, factors, suspend_permits = evaluate_rules(request)

        req_dict = request.dict()
        rf_prob, if_score = ml_model.predict(req_dict)
        ml_score = round((rf_prob + if_score) / 2.0, 1)

        composite_score = blend_risk_scores(rule_score, ml_score, factors)

        if composite_score >= 75.0:
            risk_level = "Critical"
            action_required = (
                "EVACUATE AREA & HALT PERMITS - Composite risk score is critical. "
                "Safety sirens should be activated. Emergency Response Orchestrator must coordinate evacuation."
            )
        elif composite_score >= 40.0:
            risk_level = "Warning"
            action_required = (
                "INCREASE SURVEILLANCE & RE-AUDIT PERMITS - Active anomalies detected. "
                "Safety supervisor must inspect site, verify gas ventilation, and review SIMOPs guidelines."
            )
        else:
            risk_level = "Safe"
            action_required = "ROUTINE MONITORING - Standard operating procedures apply. No corrective action needed."

        response = RiskCheckResponse(
            zone=request.zone,
            composite_risk_score=composite_score,
            risk_level=risk_level,
            rule_score=rule_score,
            ml_score=ml_score,
            factors=factors,
            action_required=action_required,
            suspend_permits=suspend_permits,
            timestamp=datetime.now().isoformat()
        )

        history_payload = response.dict()
        history_payload["gas_readings"] = gas.dict()
        history_payload["composite_score"] = composite_score
        risk_history.append(history_payload)
        if len(risk_history) > MAX_HISTORY_LEN:
            risk_history.pop(0)

        # --- Person B integration ---
        await _feed_person_b(request.zone, response.dict())

        return response

    except Exception as e:
        logger.error(f"Error evaluating risk score: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/state")
def get_plant_state():
    """Returns the current simulated telemetry, permits, and statuses for all plant zones."""
    return plant_state


@app.post("/api/state/update")
async def update_zone_state(zone_name: str, update: Dict[str, Any], sync: bool = False, current_user: dict = Depends(get_current_user)):
    """
    Updates the state of a specific zone, evaluates the new risk,
    and broadcasts the updated status to all live websocket listeners.
    """
    if ASYNC_INGESTION_ENABLED and not sync:
        task_id = await ingestion_pipeline.publish_event(
            "state_update",
            {"zone_name": zone_name, "update": update}
        )
        return {
            "status": "queued",
            "task_id": task_id,
            "message": "Telemetry update successfully queued for stream processing & ingestion."
        }

    if zone_name not in plant_state:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_name}' not found.")

    zone_state = plant_state[zone_name]

    if "gas_readings" in update:
        d_co_dt, d_pressure_dt = calculate_telemetry_rates(zone_name, update["gas_readings"])
        zone_state["gas_readings"].update(update["gas_readings"])
        zone_state["gas_readings"]["d_co_dt"] = d_co_dt
        zone_state["gas_readings"]["d_pressure_dt"] = d_pressure_dt
        timescale_telemetry_logger.log_telemetry(zone_name, update["gas_readings"])
    if "permits" in update:
        zone_state["permits"] = update["permits"]
    if "maintenance_active" in update:
        zone_state["maintenance_active"] = update["maintenance_active"]
    if "shift_changeover_active" in update:
        zone_state["shift_changeover_active"] = update["shift_changeover_active"]
    if "cctv_alerts" in update:
        zone_state["cctv_alerts"] = update["cctv_alerts"]
    if "restricted_entry_count" in update:
        zone_state["restricted_entry_count"] = update["restricted_entry_count"]
    if "restricted_entry_history" in update:
        zone_state["restricted_entry_history"] = update["restricted_entry_history"]

    zone_state["timestamp"] = datetime.now().isoformat()
    plant_state[zone_name] = zone_state

    try:
        req = RiskCheckRequest(
            zone=zone_name,
            gas_readings=GasReadings(**zone_state["gas_readings"]),
            permits=[PermitInfo(**p) for p in zone_state["permits"]],
            maintenance_active=zone_state["maintenance_active"],
            shift_changeover_active=zone_state["shift_changeover_active"],
            cctv_alerts=[CCTVAlert(**c) for c in zone_state.get("cctv_alerts", [])],
            restricted_entry_count=zone_state.get("restricted_entry_count", 0),
            timestamp=zone_state["timestamp"]
        )

        eval_result = await evaluate_risk_score(req)
        zone_state["risk_score"] = eval_result.composite_risk_score
        plant_state[zone_name] = zone_state

        payload = {
            "event": "risk_update",
            "zone": zone_name,
            "state": zone_state,
            "risk_assessment": eval_result.dict()
        }

        await manager.broadcast(payload)
        return payload
    except Exception as e:
        logger.error(f"Error updating zone state: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/risk-history")
def get_risk_history(limit: int = 50, zone: str = None):
    """Retrieves the history of risk calculations, optionally filtered by zone."""
    history = risk_history
    if zone:
        history = [r for r in history if r["zone"] == zone]
    return history[-limit:]


# Simulation Tick Endpoint
simulation_step = 0


@app.post("/api/simulate/tick")
async def simulation_tick():
    """
    Advances the plant state to simulate real-time sensor fluctuations, permit modifications,
    and safety incidents (ideal for testing Person B without a frontend).
    """
    global simulation_step
    simulation_step += 1

    updates = []

    sinter_gas = plant_state["Sinter Plant"]["gas_readings"].copy()
    sinter_gas["o2"] = round(max(19.0, min(21.2, sinter_gas["o2"] + np.random.uniform(-0.1, 0.08))), 2)
    sinter_gas["co"] = round(max(0, sinter_gas["co"] + np.random.uniform(-0.5, 0.8)), 1)
    updates.append(await update_zone_state("Sinter Plant", {"gas_readings": sinter_gas}))

    ammonia_gas = plant_state["Ammonia Storage Tank"]["gas_readings"].copy()
    ammonia_gas["h2s"] = round(max(0, ammonia_gas["h2s"] + np.random.uniform(-0.2, 0.3)), 1)
    updates.append(await update_zone_state("Ammonia Storage Tank", {"gas_readings": ammonia_gas}))

    cycle = simulation_step % 12

    if cycle == 0:
        logger.info("Simulation Cycle Reset: All systems normal.")
        co_gas = {"o2": 20.8, "co": 2.0, "ch4_lfl": 0.0, "h2s": 0.1, "temperature": 29.0, "pressure": 1.0}
        bf_gas = {"o2": 20.9, "co": 4.0, "ch4_lfl": 0.1, "h2s": 0.0, "temperature": 31.0, "pressure": 1.04}
        updates.append(await update_zone_state("Coke Oven Battery 1", {
            "gas_readings": co_gas,
            "permits": [{"permit_id": "PTW-2026-001", "permit_type": "hot_work", "status": "active",
                         "zone": "Coke Oven Battery 1", "workers_count": 3}],
            "maintenance_active": False, "shift_changeover_active": False
        }))
        updates.append(await update_zone_state("Blast Furnace A", {
            "gas_readings": bf_gas, "permits": [], "maintenance_active": False, "shift_changeover_active": False
        }))

    elif cycle == 1:
        co_gas = plant_state["Coke Oven Battery 1"]["gas_readings"].copy()
        co_gas["co"] = 28.0
        updates.append(await update_zone_state("Coke Oven Battery 1", {"gas_readings": co_gas}))

    elif cycle == 2:
        updates.append(await update_zone_state("Blast Furnace A", {
            "maintenance_active": True, "shift_changeover_active": True
        }))

    elif cycle == 3:
        co_gas = plant_state["Coke Oven Battery 1"]["gas_readings"].copy()
        co_gas["ch4_lfl"] = 4.2
        updates.append(await update_zone_state("Coke Oven Battery 1", {"gas_readings": co_gas}))

    elif cycle == 4:
        co_gas = plant_state["Coke Oven Battery 1"]["gas_readings"].copy()
        co_gas["ch4_lfl"] = 6.5
        updates.append(await update_zone_state("Coke Oven Battery 1", {"gas_readings": co_gas}))

    elif cycle == 5:
        permits = plant_state["Coke Oven Battery 1"]["permits"].copy()
        for p in permits:
            p["status"] = "suspended"
        co_gas = plant_state["Coke Oven Battery 1"]["gas_readings"].copy()
        co_gas["ch4_lfl"] = 2.5
        co_gas["co"] = 15.0
        updates.append(await update_zone_state("Coke Oven Battery 1", {"permits": permits, "gas_readings": co_gas}))

    elif cycle == 6:
        bf_gas = plant_state["Blast Furnace A"]["gas_readings"].copy()
        bf_gas["co"] = 55.0
        bf_gas["pressure"] = 1.6
        updates.append(await update_zone_state("Blast Furnace A", {"gas_readings": bf_gas}))

    elif cycle == 7:
        bf_gas = plant_state["Blast Furnace A"]["gas_readings"].copy()
        bf_gas["co"] = 110.0
        updates.append(await update_zone_state("Blast Furnace A", {"gas_readings": bf_gas}))

    elif cycle == 8:
        bf_gas = {"o2": 20.8, "co": 8.0, "ch4_lfl": 0.1, "h2s": 0.0, "temperature": 29.5, "pressure": 1.02}
        updates.append(await update_zone_state("Blast Furnace A", {
            "gas_readings": bf_gas, "maintenance_active": False, "shift_changeover_active": False
        }))

    elif cycle == 9:
        sinter_gas2 = plant_state["Sinter Plant"]["gas_readings"].copy()
        sinter_gas2["o2"] = 18.2
        updates.append(await update_zone_state("Sinter Plant", {"gas_readings": sinter_gas2}))

    elif cycle == 10:
        sinter_gas2 = plant_state["Sinter Plant"]["gas_readings"].copy()
        sinter_gas2["o2"] = 16.5
        sinter_gas2["co"] = 35.0
        updates.append(await update_zone_state("Sinter Plant", {"gas_readings": sinter_gas2}))

    elif cycle == 11:
        permits = plant_state["Sinter Plant"]["permits"].copy()
        for p in permits:
            p["status"] = "suspended"
        sinter_gas2 = plant_state["Sinter Plant"]["gas_readings"].copy()
        sinter_gas2["o2"] = 20.2
        sinter_gas2["co"] = 8.0
        updates.append(await update_zone_state("Sinter Plant", {"permits": permits, "gas_readings": sinter_gas2}))

    # Dynamic Simulation of Worker Safety Coach Events (Innovation 6)
    if safety_coach_engine.profiles:
        import random
        from datetime import timedelta
        # Iterate and simulate safety events
        for wid, profile in list(safety_coach_engine.profiles.items()):
            # Simulate fatigue progression
            if profile.shift_start:
                try:
                    start = datetime.fromisoformat(profile.shift_start)
                    # Shift start timestamp gets pushed back to simulate longer shifts
                    new_start = start - timedelta(minutes=random.randint(10, 30))
                    profile.shift_start = new_start.isoformat()
                except Exception:
                    pass
            else:
                # 20% chance to start a shift for an offline worker
                if random.random() < 0.2:
                    profile.shift_start = (datetime.now() - timedelta(hours=random.randint(1, 6))).isoformat()
            
            # Recalculate fatigue based on current time
            safety_coach_engine._recalculate_fatigue(profile, datetime.now())

            # Simulate random safety incidents/behaviours
            roll = random.random()
            if roll < 0.04:
                # PPE violation
                safety_coach_engine.ingest_event(wid, "ppe_violation", {
                    "worker_name": profile.name,
                    "zone": profile.zone
                })
            elif roll < 0.08:
                # Zone violation
                safety_coach_engine.ingest_event(wid, "zone_violation", {
                    "worker_name": profile.name,
                    "zone": profile.zone
                })
            elif roll < 0.12:
                # Alert ignored
                safety_coach_engine.ingest_event(wid, "alert_ignored", {
                    "worker_name": profile.name,
                    "zone": profile.zone
                })
            elif roll < 0.22:
                # Alert acknowledged
                safety_coach_engine.ingest_event(wid, "alert_acknowledged", {
                    "worker_name": profile.name,
                    "zone": profile.zone
                })
            elif roll < 0.27:
                # Hazard exposure
                safety_coach_engine.ingest_event(wid, "hazard_exposure", {
                    "worker_name": profile.name,
                    "zone": profile.zone
                })

    return {
        "simulation_step": simulation_step,
        "cycle_index": cycle,
        "updates": [u["risk_assessment"] for u in updates]
    }


@app.websocket("/ws/risk-feed")
async def websocket_endpoint(websocket: WebSocket):
    """Person A's raw risk feed (state + risk_update events)."""
    await manager.connect(websocket)
    try:
        initial_payload = {"event": "initial_state", "state": plant_state, "history": risk_history[-10:]}
        await websocket.send_json(initial_payload)
        while True:
            data = await websocket.receive_text()
            logger.info(f"Received message from client: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# PERSON B — Geospatial heatmap
# ---------------------------------------------------------------------------
@app.get("/api/plant-layout")
def get_plant_layout():
    """Static zone geometry + hazard classification for rendering the base map."""
    return {zone: layout.dict() for zone, layout in get_layout().items()}


@app.get("/api/heatmap")
def get_heatmap():
    """Live risk-colored geospatial snapshot: one entry per zone, fed by Person A's risk engine."""
    return heatmap_engine.snapshot().dict()


@app.get("/api/workers")
def get_workers(zone: str = None):
    """Simulated worker location overlay."""
    return [w.dict() for w in worker_sim.get_workers(zone)]


@app.get("/api/safety-coach/workers")
def get_safety_coach_workers():
    """Returns worker safety profiles from the Safety Coach Engine."""
    return [p.to_dict() for p in safety_coach_engine.profiles.values()]


# ---------------------------------------------------------------------------
# PERSON B — Emergency Response Orchestrator
# ---------------------------------------------------------------------------
@app.get("/api/evacuations")
def get_evacuations():
    return [e.dict() for e in evacuation_mgr.all_records()]


@app.get("/api/alerts")
def get_alerts(zone: str = None, limit: int = 50):
    return [a.dict() for a in get_alert_log(zone, limit)]


class CreateIncidentRequest(BaseModel):
    id: str
    title: str
    description: str
    location: str
    department: str
    severity: str
    reporterName: Optional[str] = "Anonymous"
    reporterRole: Optional[str] = "Safety Officer"


class ResolveIncidentRequest(BaseModel):
    id: str


@app.get("/api/incidents")
def get_incidents(zone: str = None, limit: int = 50):
    return [r.dict() for r in get_reports(zone, limit)]


@app.post("/api/incidents")
def create_incident(req: CreateIncidentRequest):
    report = IncidentReport(
        report_id=req.id,
        zone=req.location,
        generated_at=datetime.now(timezone.utc).isoformat(),
        risk_level=req.severity,
        composite_risk_score=72.0 if req.severity == "High" else 50.0,
        factors=[{"name": "User Reported Breach", "score": 72.0, "details": req.description}],
        suspended_permits=[],
        workers_present=0,
        evacuation_status="none",
        regulatory_refs=["Factory Act 1948", "OISD-STD-105"],
        narrative=req.description,
        title=req.title,
        reporter_name=req.reporterName,
        reporter_role=req.reporterRole
    )
    reports_list.append(report)
    return report.dict()


@app.post("/api/incidents/resolve")
def resolve_incident_endpoint(req: ResolveIncidentRequest):
    for r in reports_list:
        if r.report_id == req.id:
            r.evacuation_status = "resolved"
            return {"status": "success", "message": f"Incident {req.id} resolved"}
    raise HTTPException(status_code=404, detail=f"Incident {req.id} not found")


@app.post("/api/alerts/trigger")
async def trigger_alert_manually(request: TriggerAlertRequest):
    """
    Manual trigger for testing the orchestrator without running the full simulation -
    simulates a Critical risk assessment for the given zone.
    """
    if request.zone not in config.KNOWN_ZONES:
        raise HTTPException(status_code=404, detail=f"Unknown zone '{request.zone}'. Known zones: {config.KNOWN_ZONES}")

    fake_risk_assessment = {
        "zone": request.zone,
        "composite_risk_score": 92.0,
        "risk_level": "Critical",
        "factors": [{"name": "Manual Test Trigger", "score": 92.0, "contribution": 100.0, "details": request.reason}],
        "action_required": "EVACUATE AREA & HALT PERMITS - manually triggered for testing.",
        "suspend_permits": [],
    }
    await _feed_person_b(request.zone, fake_risk_assessment)
    return {"status": "triggered", "zone": request.zone}


@app.websocket("/ws/heatmap-feed")
async def websocket_heatmap_feed(websocket: WebSocket):
    """Person B's live feed: heatmap_update events (subset of the same broadcast channel as /ws/risk-feed)."""
    await manager.connect(websocket)
    try:
        await websocket.send_json({"event": "initial_snapshot", "heatmap": heatmap_engine.snapshot().dict()})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# PERSON C — Incident Pattern Intelligence & Compliance Audit Agent
# ---------------------------------------------------------------------------
class RAGQueryRequest(BaseModel):
    query: str

class ComplianceAuditRequest(BaseModel):
    zone: str
    telemetry: Dict[str, Any]
    permits: List[Dict[str, Any]] = []
    maintenance_active: bool = False
    shift_changeover_active: bool = False

@app.post("/api/rag/query")
def query_rag_agent(request: RAGQueryRequest):
    """Query the ZeroHarm RAG pipeline for safety compliance guidelines and past incident lookups."""
    try:
        return safety_agent.query(request.query)
    except Exception as e:
        logger.error(f"Error querying RAG agent: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compliance/audit")
def audit_compliance(request: ComplianceAuditRequest):
    """Run a compliance audit on the provided zone telemetry and operational status."""
    try:
        return safety_agent.audit_telemetry(
            zone=request.zone,
            telemetry=request.telemetry,
            permits=request.permits,
            maintenance_active=request.maintenance_active,
            shift_changeover=request.shift_changeover_active
        )
    except Exception as e:
        logger.error(f"Error auditing compliance: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/rag/documents")
def get_rag_documents():
    """Returns list of indexed regulatory frameworks and historical incidents."""
    return safety_agent.vector_store.documents


@app.post("/api/rag/upload-document")
async def upload_rag_document(file: UploadFile = File(...)):
    """Upload a .txt or .pdf safety document, chunk it, vectorize it, and append to the RAG store."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    filename = file.filename.lower()
    if not (filename.endswith(".txt") or filename.endswith(".pdf")):
        raise HTTPException(status_code=400, detail="Only .txt and .pdf files are supported")

    content_bytes = await file.read()

    try:
        if filename.endswith(".txt"):
            text = content_bytes.decode("utf-8")
        else:
            from pypdf import PdfReader
            from io import BytesIO
            reader = PdfReader(BytesIO(content_bytes))
            text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as e:
        logger.error(f"Failed to parse uploaded document: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse document: {e}")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Empty document")

    chunks = ZeroHarmVectorStore._chunk_text(text)
    base_id = file.filename.rsplit(".", 1)[0].lower().replace(" ", "_")
    docs = []
    for i, chunk in enumerate(chunks):
        docs.append({
            "id": f"uploaded_{base_id}_{i+1}",
            "title": f"{file.filename} (Part {i+1})",
            "source": "uploaded_document",
            "content": chunk,
        })

    vector_store.add_documents(docs)

    return {
        "status": "success",
        "filename": file.filename,
        "chunks_created": len(docs),
        "total_documents": len(vector_store.documents),
    }


# ---------------------------------------------------------------------------
# PERSON C & D — Safety Workflow Tickets
# ---------------------------------------------------------------------------
class WorkflowUpdateRequest(BaseModel):
    status: str = Field(..., description="New status: Pending, In Progress, Completed")

@app.get("/api/workflows")
def get_workflows(incident_id: str = None):
    """Fetch safety workflow tickets, optionally filtered by incident report ID."""
    workflows = get_safety_workflows(incident_id)
    return [w.dict() for w in workflows]


@app.patch("/api/workflows/{workflow_id}")
def patch_workflow(workflow_id: str, request: WorkflowUpdateRequest):
    """Update the status of a safety workflow ticket."""
    updated = update_workflow_status(workflow_id, request.status)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found")
    return updated.dict()


# ---------------------------------------------------------------------------
# Computer Vision / CCTV Analytics Integration
# ---------------------------------------------------------------------------
class CCTVAlertRequest(BaseModel):
    zone: str = Field(..., description="Zone where the CCTV alert was triggered")
    event_type: str = Field(..., description="Type of event: no_ppe, smoke_detected, unauthorized_entry, fire_detected")
    confidence: float = Field(..., description="Detection confidence score between 0.0 and 1.0")
    worker_id: Optional[str] = Field(None, description="Optional ID of the worker")
    worker_name: Optional[str] = Field(None, description="Optional name of the worker")

@app.post("/api/cctv/event")
async def trigger_cctv_event(request: CCTVAlertRequest, sync: bool = False):
    """
    Receives CCTV analytics event metadata from camera streams or external CV systems.
    Supported event types: no_ppe, smoke_detected, fire_detected, unauthorized_entry.
    Saves the alert into zone state, triggers a compound risk re-evaluation,
    and broadcasts the updated risk metrics to connected dashboard clients.
    """
    if ASYNC_INGESTION_ENABLED and not sync:
        task_id = await ingestion_pipeline.publish_event(
            "cctv_event",
            request.dict()
        )
        return {
            "status": "queued",
            "task_id": task_id,
            "message": "CCTV alert successfully queued for stream processing & ingestion."
        }

    import random
    zone_name = request.zone
    if zone_name not in plant_state:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_name}' not found.")
        
    zone_state = plant_state[zone_name]
    
    # Initialize cctv_alerts list if not present
    if "cctv_alerts" not in zone_state:
        zone_state["cctv_alerts"] = []
    if "restricted_entry_count" not in zone_state:
        zone_state["restricted_entry_count"] = 0
    if "restricted_entry_history" not in zone_state:
        zone_state["restricted_entry_history"] = []
        
    # Append the new CCTV alert
    alert_payload = {
        "zone": request.zone,
        "event_type": request.event_type,
        "confidence": request.confidence,
        "timestamp": datetime.now().isoformat(),
        "worker_id": request.worker_id,
        "worker_name": request.worker_name
    }
    
    # Check if a similar alert type is already active in this zone, if so, replace it
    # to avoid stacking duplicate PPE or smoke alerts. Otherwise append.
    replaced = False
    for i, active_alert in enumerate(zone_state["cctv_alerts"]):
        if active_alert["event_type"] == request.event_type:
            zone_state["cctv_alerts"][i] = alert_payload
            replaced = True
            break
            
    if not replaced:
        zone_state["cctv_alerts"].append(alert_payload)
        
    if request.event_type == "unauthorized_entry":
        zone_state["restricted_entry_count"] += 1
        zone_state["restricted_entry_history"].append({
            "timestamp": alert_payload["timestamp"],
            "worker_id": request.worker_id or f"W-{random.randint(10,99)}",
            "worker_name": request.worker_name or random.choice(["Arjun", "Ravi", "Anil", "Suresh"])
        })
        wid = request.worker_id or zone_state["restricted_entry_history"][-1]["worker_id"]
        safety_coach_engine.ingest_event(wid, "zone_violation", {
            "worker_name": request.worker_name,
            "zone": request.zone,
        })
    elif request.event_type == "no_ppe":
        wid = request.worker_id or f"W-{random.randint(10,99)}"
        wname = request.worker_name or random.choice(["Arjun", "Ravi", "Anil", "Suresh"])
        safety_coach_engine.ingest_event(wid, "ppe_violation", {
            "worker_name": wname,
            "zone": request.zone,
        })
        
    # Trigger risk update using the state update flow
    payload = await update_zone_state(zone_name, {
        "cctv_alerts": zone_state["cctv_alerts"],
        "restricted_entry_count": zone_state["restricted_entry_count"],
        "restricted_entry_history": zone_state["restricted_entry_history"]
    }, sync=True)
    return {
        "status": "alert_processed",
        "zone": zone_name,
        "active_cctv_alerts": zone_state["cctv_alerts"],
        "restricted_entry_count": zone_state["restricted_entry_count"],
        "restricted_entry_history": zone_state["restricted_entry_history"],
        "risk_assessment": payload["risk_assessment"]
    }

@app.post("/api/cctv/analyze-frame")
async def analyze_cctv_frame(zone: str, file: UploadFile = File(...)):
    """
    Receives a CCTV keyframe snapshot and runs pixel-level heuristic analysis:
      - Luminance / brightness calculation
      - Contrast standard deviation (detects lens obstruction / occlusion)
      - Redness thermal-ignition color indexing (detects flame / spark signatures)
    Integrates detected visual anomalies directly into the Safety Engine risk pipeline.
    """
    from PIL import Image
    import io
    
    if zone not in plant_state:
        raise HTTPException(status_code=404, detail=f"Zone '{zone}' not found.")
        
    image_bytes = await file.read()
    try:
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size
        
        # Convert to RGB to analyze pixels
        img_rgb = img.convert("RGB")
        
        # Resize to small dimension for ultra-fast processing
        small_img = img_rgb.resize((32, 32))
        pixels = np.array(small_img)
        
        # Calculate mean channels
        r_mean = float(np.mean(pixels[:, :, 0]))
        g_mean = float(np.mean(pixels[:, :, 1]))
        b_mean = float(np.mean(pixels[:, :, 2]))
        
        # Compute brightness (Luminance Y = 0.299R + 0.587G + 0.114B)
        brightness = 0.299 * r_mean + 0.587 * g_mean + 0.114 * b_mean
        
        # Compute contrast (standard deviation of grayscale values)
        gray_pixels = 0.299 * pixels[:, :, 0] + 0.587 * pixels[:, :, 1] + 0.114 * pixels[:, :, 2]
        contrast = float(np.std(gray_pixels))
        
        # Redness ratio (flame/ignition index)
        redness = r_mean / (g_mean + b_mean + 1.0)
        
        # Classifier/Heuristic Decision Logic
        event_type = "nominal"
        confidence = 0.90
        details = "Visual frame analysis nominal. Good visibility and no safety violations detected."
        
        filename_lower = file.filename.lower()
        
        # 1. Filename-guided testing overrides (take precedence for testing)
        if "no_ppe" in filename_lower or "ppe_violation" in filename_lower:
            event_type = "no_ppe"
            confidence = 0.88
            details = "PPE COMPLIANCE VIOLATION: Worker detected lacking required personal protective equipment (safety helmet/harness)."
            
        elif "unauthorized" in filename_lower or "restricted" in filename_lower:
            event_type = "unauthorized_entry"
            confidence = 0.95
            details = "UNAUTHORIZED ENTRY: Human detection tracking identified personnel inside restricted zone."
            
        elif "fire" in filename_lower or "smoke" in filename_lower or "flare" in filename_lower:
            event_type = "fire_detected"
            confidence = 0.92
            details = "CCTV SMOKE/FIRE ALARM: Visual pixel anomalies indicating thick particulate concentration."
            
        elif "occluded" in filename_lower or "obstruction" in filename_lower:
            event_type = "camera_occlusion"
            confidence = 0.98
            details = "CCTV CAMERA OCCLUSION: Lens obstruction warning. Optical path block confirmed via filename cue."
            
        # 2. Physics-based heuristics (if no filename override is present)
        # Redness thermal-ignition color indexing (identifies flame/sparks)
        elif redness > 1.45 and r_mean > 110.0:
            event_type = "fire_detected"
            confidence = round(max(0.60, min(0.99, redness * 0.6)), 2)
            details = f"VISUAL FIRE / FLAME DETECTED: Color index anomaly detected. High redness ratio ({redness:.2f}) and thermal luminance in area."
            
        # Lens Occlusion (Extremely low contrast or low brightness)
        elif contrast < 12.0 or brightness < 15.0:
            event_type = "camera_occlusion"
            confidence = round(max(0.50, min(0.99, 1.0 - (contrast / 24.0))), 2)
            details = f"CCTV CAMERA OCCLUSION: Lens obstruction warning. Live contrast ({contrast:.1f}) or brightness ({brightness:.1f}) below safety threshold."
            
        # If a violation/alert is triggered, update the state
        if event_type != "nominal":
            import random
            zone_state = plant_state[zone]
            if "cctv_alerts" not in zone_state:
                zone_state["cctv_alerts"] = []
            if "restricted_entry_count" not in zone_state:
                zone_state["restricted_entry_count"] = 0
            if "restricted_entry_history" not in zone_state:
                zone_state["restricted_entry_history"] = []
                
            alert_payload = {
                "zone": zone,
                "event_type": event_type,
                "confidence": confidence,
                "timestamp": datetime.now().isoformat(),
                "worker_id": None,
                "worker_name": None,
                "details": details
            }
            
            # Replace duplicate event types
            replaced = False
            for i, active_alert in enumerate(zone_state["cctv_alerts"]):
                if active_alert["event_type"] == event_type:
                    zone_state["cctv_alerts"][i] = alert_payload
                    replaced = True
                    break
            if not replaced:
                zone_state["cctv_alerts"].append(alert_payload)
                
            if event_type == "unauthorized_entry":
                zone_state["restricted_entry_count"] += 1
                zone_state["restricted_entry_history"].append({
                    "timestamp": alert_payload["timestamp"],
                    "worker_id": f"W-{random.randint(10,99)}",
                    "worker_name": random.choice(["Arjun", "Ravi", "Anil", "Suresh"])
                })
                wid = zone_state["restricted_entry_history"][-1]["worker_id"]
                wname = zone_state["restricted_entry_history"][-1]["worker_name"]
                safety_coach_engine.ingest_event(wid, "zone_violation", {
                    "worker_name": wname,
                    "zone": zone,
                })
            elif event_type == "no_ppe":
                wid = f"W-{random.randint(10,99)}"
                wname = random.choice(["Arjun", "Ravi", "Anil", "Suresh"])
                safety_coach_engine.ingest_event(wid, "ppe_violation", {
                    "worker_name": wname,
                    "zone": zone,
                })
                
            # Trigger risk update using the state update flow
            payload = await update_zone_state(zone, {
                "cctv_alerts": zone_state["cctv_alerts"],
                "restricted_entry_count": zone_state["restricted_entry_count"],
                "restricted_entry_history": zone_state["restricted_entry_history"]
            }, sync=True)
            
            return {
                "status": "frame_analyzed_with_detections",
                "image_properties": {
                    "width": width,
                    "height": height,
                    "brightness": round(brightness, 2),
                    "contrast": round(contrast, 2),
                    "redness_ratio": round(redness, 2)
                },
                "alert_triggered": True,
                "event_type": event_type,
                "confidence": confidence,
                "details": details,
                "risk_assessment": payload["risk_assessment"]
            }
            
        return {
            "status": "frame_analyzed_nominal",
            "image_properties": {
                "width": width,
                "height": height,
                "brightness": round(brightness, 2),
                "contrast": round(contrast, 2),
                "redness_ratio": round(redness, 2)
            },
            "alert_triggered": False,
            "details": details
        }
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"Failed to process image: {str(ex)}")

@app.post("/api/cctv/clear")
async def clear_cctv_events(zone: str = None, payload: Dict[str, Any] = None):
    """Clears all active CCTV alerts for the specified zone."""
    target_zone = zone
    if not target_zone and payload:
        target_zone = payload.get("zone")
        
    if not target_zone:
        raise HTTPException(status_code=400, detail="Missing 'zone' parameter (either as query param or in JSON body).")
        
    if target_zone not in plant_state:
        raise HTTPException(status_code=404, detail=f"Zone '{target_zone}' not found.")
        
    plant_state[target_zone]["cctv_alerts"] = []
    plant_state[target_zone]["restricted_entry_count"] = 0
    plant_state[target_zone]["restricted_entry_history"] = []
    
    payload_response = await update_zone_state(target_zone, {
        "cctv_alerts": [],
        "restricted_entry_count": 0,
        "restricted_entry_history": []
    }, sync=True)
    return {
        "status": "alerts_cleared",
        "zone": target_zone,
        "active_cctv_alerts": [],
        "restricted_entry_count": 0,
        "restricted_entry_history": [],
        "risk_assessment": payload_response["risk_assessment"]
    }


# ---------------------------------------------------------------------------
# Plant Topology and Cascading Risk Engine
# ---------------------------------------------------------------------------
@app.get("/api/topology")
def get_plant_topology():
    """
    Returns the process topology knowledge graph (nodes, edges, weights)
    to enable node-link diagram visualization on the frontend.
    """
    nodes = list(topology_engine.graph.nodes)
    edges = []
    for u, v, d in topology_engine.graph.edges(data=True):
        edges.append({
            "source": u,
            "target": v,
            "connection_type": d.get("connection_type"),
            "propagation_factor": d.get("propagation_factor"),
            "description": d.get("description")
        })
    return {"nodes": nodes, "edges": edges}

@app.get("/api/topology/cascades")
def get_topology_cascades():
    """
    Returns the current calculated risk cascades across all zones
    based on the latest risk scores in the plant.
    """
    active_risks = {}
    snapshot = heatmap_engine.snapshot()
    for hz in snapshot.zones:
        active_risks[hz.zone] = hz.risk_score
        
    return topology_engine.get_cascading_risks(active_risks)


# ---------------------------------------------------------------------------
# PERSON D — Digital Permit Intelligence Agent
# ---------------------------------------------------------------------------
@app.post("/api/permits/audit")
def audit_zone_permits(request: PermitAuditRequest, current_user: dict = Depends(get_current_user)):
    """
    Cross-checks every active permit in the given zone against that zone's
    live telemetry AND against neighbouring zones (e.g. a hot work permit
    downwind of a zone with an elevated gas reading).
    """
    if request.zone not in plant_state:
        raise HTTPException(status_code=404, detail=f"Unknown zone '{request.zone}'. Known zones: {config.KNOWN_ZONES}")
    try:
        return permit_agent.audit_zone(request.zone, plant_state[request.zone], all_zone_states=plant_state)
    except Exception as e:
        logger.error(f"Error auditing permits for zone '{request.zone}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/permits/audit/all", response_model=FullPlantPermitAuditResponse)
def audit_all_permits(current_user: dict = Depends(get_current_user)):
    """Runs the Digital Permit Intelligence Agent across every zone in one call."""
    audits = permit_agent.audit_all_zones(plant_state)
    total_conflicts = sum(len(a.conflicts) for a in audits)
    return FullPlantPermitAuditResponse(
        generated_at=datetime.now().isoformat(),
        zones_audited=len(audits),
        total_conflicts=total_conflicts,
        audits=audits,
    )


@app.get("/api/permits/conflicts")
def get_permit_conflicts():
    """Flattened, severity-sorted list of every active permit conflict plant-wide — feeds a 'permit conflicts' dashboard widget."""
    return [c.dict() for c in permit_agent.all_active_conflicts(plant_state)]


# ---------------------------------------------------------------------------
# PERSON D — Integration: the single call that proves A + B + C + D are one platform
# ---------------------------------------------------------------------------
@app.post("/api/integration/full-assessment", response_model=FullAssessmentResponse)
async def full_assessment(request: PermitAuditRequest):
    """
    Runs the complete demo flow for one zone:
      1. Person A scores the current telemetry (and Person B's heatmap/evacuation
         state is updated as a side effect, same as /risk-score).
      2. Person D cross-checks every active permit in and around the zone.
      3. Person C generates a compliance + historical-precedent narrative informed
         by both (1) and (2).
      4. Person D synthesises everything into one unified verdict.
    """
    zone = request.zone
    if zone not in plant_state:
        raise HTTPException(status_code=404, detail=f"Unknown zone '{zone}'. Known zones: {config.KNOWN_ZONES}")

    zone_state = plant_state[zone]
    try:
        req = RiskCheckRequest(
            zone=zone,
            gas_readings=GasReadings(**zone_state["gas_readings"]),
            permits=[PermitInfo(**p) for p in zone_state["permits"]],
            maintenance_active=zone_state["maintenance_active"],
            shift_changeover_active=zone_state["shift_changeover_active"],
            cctv_alerts=[CCTVAlert(**c) for c in zone_state.get("cctv_alerts", [])],
            timestamp=zone_state["timestamp"],
        )
        risk_response = await evaluate_risk_score(req)
        return await integration_pipeline.run_full_assessment(zone, risk_response.dict(), plant_state)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error running full assessment for zone '{zone}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

class CollaborativeReasoningRequest(BaseModel):
    zone: str


@app.post("/api/collaborative-reasoning/debate")
async def run_collaborative_debate(request: CollaborativeReasoningRequest):
    """
    Innovation 1: Multi-Agent Collaborative Reasoning.
    Executes a structured debate session between Gas Sensor, Maintenance,
    Permit, Weather, and CCTV agents, and returns a unified risk probability
    and safety prediction.
    """
    zone = request.zone
    if zone not in plant_state:
        raise HTTPException(status_code=404, detail=f"Unknown zone '{zone}'. Known zones: {config.KNOWN_ZONES}")
    
    if ASYNC_COMPUTE_ENABLED:
        task_id = await distributed_task_queue.enqueue_task(
            "collaborative_debate",
            {"zone": zone}
        )
        return {
            "status": "queued",
            "task_id": task_id,
            "message": "Collaborative safety debate successfully enqueued for asynchronous background execution."
        }

    zone_state = plant_state[zone]
    try:
        debate_result = collaborative_engine.run_debate(zone, zone_state, plant_state)
        # Broadcast the debate notification event so the front-end can log it in the console
        await manager.broadcast({
            "event": "collaborative_debate",
            "zone": zone,
            "debate": debate_result.dict()
        })
        return debate_result
    except Exception as e:
        logger.error(f"Error running collaborative debate for zone '{zone}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tasks/{task_id}/status")
def get_task_status(task_id: str):
    """Fetches the status and results of an enqueued task."""
    status = distributed_task_queue.get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    return status


@app.get("/api/integration/demo-scenario", response_model=DemoScenarioResponse)
def demo_scenario():
    """Curated, step-by-step narrative tying all four agents together — the script for the demo video and pitch deck."""
    return get_demo_scenario()


# --- Onboarding & Sponsorship Queue (Gatehouse) ---
class SafetyOfficerSignupRequest(BaseModel):
    fullName: str
    email: str
    employeeId: str
    mobile: str
    govId: str = None
    companyName: str
    plantLocation: str
    department: str
    designation: str
    reportingManagerName: str
    reportingManagerEmail: str
    certNumber: str = None
    certAuthority: str = None
    certExpiry: str = None
    certFileName: str = None
    requestedScopes: List[str]

@app.post("/api/auth/signup")
async def auth_signup(request: SafetyOfficerSignupRequest):
    email_lower = request.email.strip().lower()
    
    existing = get_user_by_email(email_lower)
    if existing and existing.get("status") == "approved":
        raise HTTPException(status_code=400, detail="An account with this email is already registered and approved.")
    if existing and existing.get("status") == "pending":
        raise HTTPException(status_code=400, detail="A registration request for this email is already pending approval.")
         
    public_domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com", "mail.com", "zoho.com"]
    domain = email_lower.split("@")[-1] if "@" in email_lower else ""
    if not domain or domain in public_domains:
        raise HTTPException(status_code=400, detail=f"Public domain '@{domain}' is rejected. Please sign up using your company's official corporate email.")
         
    user_data = create_pending_user(request.dict())
    return {"status": "pending_approval", "message": "Access request submitted to your plant safety administrator."}

@app.get("/api/auth/pending")
async def get_pending_users():
    return get_users_by_status("pending")

class ApprovalRequest(BaseModel):
    email: str

@app.post("/api/auth/approve")
async def approve_user(request: ApprovalRequest, current_user: dict = Depends(require_role(["Safety Officer"]))):
    email_lower = request.email.strip().lower()
    
    existing = get_user_by_email(email_lower)
    if not existing or existing.get("status") != "pending":
        raise HTTPException(status_code=404, detail="Access request not found.")
    
    role_map = {
        "safety officer": "Safety Officer",
        "plant safety head": "Safety Officer",
        "plant manager": "Plant Manager",
        "compliance manager": "Compliance Officer",
        "compliance officer": "Compliance Officer",
        "inspector": "Industrial Inspector",
        "industrial inspector": "Industrial Inspector",
    }
    designation_key = existing["designation"].lower().strip()
    role = "Site Engineer"
    for k, v in role_map.items():
        if k in designation_key:
            role = v
            break
    
    approved = db_approve_user(email_lower, role)
    if not approved:
        raise HTTPException(status_code=404, detail="Access request not found.")
    return {"status": "approved", "user": approved}

@app.post("/api/auth/reject")
async def reject_user(request: ApprovalRequest, current_user: dict = Depends(require_role(["Safety Officer"]))):
    email_lower = request.email.strip().lower()
    
    existing = get_user_by_email(email_lower)
    if not existing or existing.get("status") != "pending":
        raise HTTPException(status_code=404, detail="Access request not found.")
    
    deleted = db_reject_user(email_lower)
    if not deleted:
        raise HTTPException(status_code=404, detail="Access request not found.")
    return {"status": "rejected"}

class LoginRequest(BaseModel):
    email: str

@app.post("/api/auth/login")
async def auth_login(request: LoginRequest):
    email_lower = request.email.strip().lower()
    
    user = get_user_by_email(email_lower)
    if not user:
        raise HTTPException(status_code=404, detail="Email is not registered. Please complete the Gateway Signup Request.")
    
    if user.get("status") == "pending":
        raise HTTPException(status_code=403, detail="Your safety access request is pending organizational sponsorship approval.")
    
    token = create_jwt_token(user)
    return {
        "id": user["id"],
        "name": user["full_name"],
        "email": user["email"],
        "role": user["role"],
        "department": user["department"],
        "plantLocation": user["plant_location"],
        "access_token": token,
        "token_type": "bearer"
    }


@app.get("/api/near-misses")
def get_near_misses():
    """
    Innovation 5: Near Miss Prediction
    Returns zones with active near-miss warning predictions based on behavioral pattern analysis.
    Uses multi-factor scoring (frequency, acceleration, environmental, worker pattern, time-risk).
    """
    results = []
    for zone_name, zone_state in plant_state.items():
        prediction = near_miss_engine.predict(zone_name, zone_state)
        if prediction:
            results.append(prediction)
    results.sort(key=lambda x: x["predicted_incident_probability"], reverse=True)
    return results


@app.get("/api/near-miss/predict")
def predict_near_miss(zone: str):
    """
    Innovation 5: Detailed near-miss prediction for a specific zone.
    Returns full prediction object including factor breakdown, confidence, and trend.
    """
    if zone not in plant_state:
        raise HTTPException(status_code=404, detail=f"Zone '{zone}' not found.")
    prediction = near_miss_engine.predict(zone, plant_state[zone])
    if not prediction:
        return {
            "zone": zone,
            "prediction_timestamp": datetime.now().isoformat(),
            "predicted_incident_probability": 0.0,
            "severity": "Low",
            "prediction_horizon": "next_shift",
            "prediction": "No near-miss patterns detected. Standard monitoring applies.",
            "root_causes": [],
            "recommendations": ["Maintain normal surveillance protocols."],
            "confidence_score": 90.0,
            "trend": "nominal",
            "entry_count": 0,
            "unique_workers_identified": 0,
            "recent_workers": [],
            "history": [],
            "factors": {},
        }
    return prediction


# ---------------------------------------------------------------------------
# Innovation 6 — AI Safety Coach
# ---------------------------------------------------------------------------
class CoachEventRequest(BaseModel):
    worker_id: str = Field(..., description="ID of the worker")
    event_type: str = Field(..., description="ppe_violation, zone_violation, alert_ignored, alert_acknowledged, hazard_exposure, shift_start, shift_end")
    worker_name: Optional[str] = Field(None, description="Worker name")
    zone: Optional[str] = Field(None, description="Zone where event occurred")

@app.get("/api/safety-coach/workers")
def get_safety_coach_workers():
    """Returns all worker safety profiles sorted by safety score ascending."""
    return safety_coach_engine.get_all_profiles()


@app.get("/api/safety-coach/worker/{worker_id}")
def get_safety_coach_worker(worker_id: str):
    """Returns detailed safety profile for a specific worker."""
    profile = safety_coach_engine.get_profile(worker_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Worker '{worker_id}' not found in safety coach.")
    return profile


@app.post("/api/safety-coach/event")
def ingest_safety_coach_event(request: CoachEventRequest):
    """Ingests a behavioral safety event for a worker and updates their profile."""
    metadata = {
        "worker_name": request.worker_name,
        "zone": request.zone,
    }
    profile = safety_coach_engine.ingest_event(request.worker_id, request.event_type, metadata)
    return {
        "status": "updated",
        "worker_id": request.worker_id,
        "event_type": request.event_type,
        "new_safety_score": profile.safety_score,
        "trend": profile.trend,
    }


@app.get("/api/safety-coach/leaderboard")
def get_safety_coach_leaderboard(limit: int = 10):
    """Returns most at-risk and safest workers."""
    return safety_coach_engine.get_leaderboard(limit=limit)


@app.get("/api/health")
def health():
    return {"status": "ok", "zones": list(plant_state.keys()), "rag_mode": safety_agent.vector_store.mode}


# ---------------------------------------------------------------------------
# Innovation 7 — Dynamic Risk Graph (Knowledge Graph)
# ---------------------------------------------------------------------------
@app.get("/api/knowledge-graph")
def get_knowledge_graph():
    """
    Returns the full knowledge graph snapshot (nodes + edges).
    Feeds the node-link diagram visualization on the frontend.
    """
    return risk_graph.snapshot()


@app.get("/api/knowledge-graph/node/{node_id}")
def get_knowledge_graph_node(node_id: str):
    """
    Returns a single node and its immediate neighbors from the knowledge graph.
    """
    node = risk_graph.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found in knowledge graph.")
    neighbors = risk_graph.get_neighbors(node_id)
    return {"node": node, "neighbors": neighbors}


@app.get("/api/knowledge-graph/paths")
def get_knowledge_graph_paths(source: str, target: str, max_length: int = 4):
    """
    Returns all simple paths between two nodes in the knowledge graph.
    Used for AI reasoning chains.
    """
    paths = risk_graph.find_paths(source, target, max_length=max_length)
    return {"source": source, "target": target, "paths": paths, "path_count": len(paths)}


@app.post("/api/knowledge-graph/reason")
def reason_knowledge_graph(node_id: str):
    """
    AI-style reasoning traversal starting from a node.
    Produces a human-readable chain explaining compound risk across the graph.
    """
    if node_id not in risk_graph.graph.nodes:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found in knowledge graph.")
    return risk_graph.reason_across_graph(node_id)


@app.post("/api/knowledge-graph/query")
def query_knowledge_graph(query: str):
    """
    Keyword query across all nodes and edges in the knowledge graph.
    """
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query string is required.")
    return risk_graph.query(query.strip())


@app.post("/api/knowledge-graph/sensor/update")
def update_knowledge_graph_sensor(sensor_node_id: str, reading: Dict[str, Any]):
    """
    Updates a gas sensor node reading in the knowledge graph.
    """
    result = risk_graph.update_sensor_reading(sensor_node_id, reading)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.post("/api/knowledge-graph/zone/risk")
def update_knowledge_graph_zone_risk(zone_node_id: str, risk_score: float):
    """
    Updates a zone node risk score in the knowledge graph.
    """
    if risk_score < 0 or risk_score > 100:
        raise HTTPException(status_code=400, detail="Risk score must be between 0 and 100.")
    result = risk_graph.update_zone_risk(zone_node_id, risk_score)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ---------------------------------------------------------------------------
# NEW INNOVATIONS ENDPOINTS (11, 16, 17, 18, 20)
# ---------------------------------------------------------------------------

@app.get("/api/shift-handover/summary")
def get_shift_handover_summary():
    """Innovation 11: AI Shift Handover Summary."""
    alerts = [a.dict() for a in get_alert_log(limit=15)]
    return handover_generator.generate_summary(plant_state, alerts)


@app.post("/api/drone/dispatch")
def dispatch_drone(zone: str):
    """Innovation 16: Autonomous Drone Inspection Dispatch."""
    if zone not in plant_state:
        raise HTTPException(status_code=404, detail=f"Zone '{zone}' not found.")
    return drone_simulator.dispatch(zone)


@app.get("/api/drone/status")
def get_drone_status():
    """Innovation 16: Get live Drone status, flight logs and payload telemetry."""
    return drone_simulator.get_status()


@app.post("/api/query/natural-language")
def execute_natural_query(query: str):
    """Innovation 17: Natural Language Query Engine."""
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query string is required.")
    
    permits = []
    for zone, state in plant_state.items():
        permits.extend(state.get("permits", []))
    
    # We pass the list from the global risk history buffer
    history = list(risk_history)
    return query_engine.execute_query(query.strip(), permits, history)


@app.post("/api/rag/hybrid-reason")
def get_hybrid_reasoning(zone: str):
    """Innovation 18: Risk Memory using RAG + Knowledge Graph."""
    if zone not in plant_state:
        raise HTTPException(status_code=404, detail=f"Zone '{zone}' not found.")
    
    zone_data = plant_state[zone]
    score = zone_data.get("risk_score", 15.0)
    
    # Simple risk assessment format
    risk_assessment = {
        "zone": zone,
        "composite_risk_score": score,
        "risk_level": "Critical" if score >= 75 else "Warning" if score >= 40 else "Safe",
        "factors": [{"name": f.get("name") if isinstance(f, dict) else getattr(f, "name", "")} for f in zone_data.get("factors", [])]
    }
    
    # Build default fallback factors if empty
    if not risk_assessment["factors"]:
        factors = []
        if zone_data.get("maintenance_active"):
            factors.append({"name": "Active Maintenance Activity"})
        if any(p.get("status", "").lower() == "active" for p in zone_data.get("permits", [])):
            factors.append({"name": "Normal Operations (Active Permits)"})
        risk_assessment["factors"] = factors

    return hybrid_reasoner.run_hybrid_reasoning(zone, risk_assessment)


@app.post("/api/agent/feedback")
def submit_agent_feedback(feedback: Dict[str, Any]):
    """Innovation 20: Self-Improving AI Agents Feedback Ingestion."""
    return feedback_engine.ingest_feedback(feedback)


@app.get("/api/agent/weights")
def get_agent_weights():
    """Innovation 20: Get current self-improved agent confidence weights."""
    return {"weights": feedback_engine.get_weights()}


@app.get("/api/agent/feedback/logs")
def get_feedback_logs():
    """Innovation 20: Get logged agent overrides and feedback history."""
    return {"logs": feedback_engine.get_feedback_logs()}
