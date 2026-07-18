from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
import os
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Tuple
from pydantic import BaseModel, Field

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

# --- Person A globals ---
ml_model = CompoundRiskMLModel()
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
plant_state: Dict[str, Dict[str, Any]] = {
    "Coke Oven Battery 1": {
        "zone": "Coke Oven Battery 1",
        "gas_readings": {"o2": 20.8, "co": 2.5, "ch4_lfl": 0.1, "h2s": 0.2, "temperature": 29.5, "pressure": 1.01},
        "permits": [{"permit_id": "PTW-2026-001", "permit_type": "hot_work", "status": "active",
                     "zone": "Coke Oven Battery 1", "workers_count": 3}],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "cctv_alerts": [],
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
        "timestamp": datetime.now().isoformat()
    }
}


# ---------------------------------------------------------------------------
# Startup / Shutdown
# ---------------------------------------------------------------------------
async def worker_tick_loop():
    while True:
        worker_sim.tick()
        await asyncio.sleep(config.WORKER_TICK_INTERVAL_SECONDS)


@app.on_event("startup")
async def startup_event():
    logger.info("Initializing risk engine ML models...")
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, ml_model.train)
    asyncio.create_task(worker_tick_loop())
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
async def update_zone_state(zone_name: str, update: Dict[str, Any]):
    """
    Updates the state of a specific zone, evaluates the new risk,
    and broadcasts the updated status to all live websocket listeners.
    """
    if zone_name not in plant_state:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_name}' not found.")

    zone_state = plant_state[zone_name]

    if "gas_readings" in update:
        d_co_dt, d_pressure_dt = calculate_telemetry_rates(zone_name, update["gas_readings"])
        zone_state["gas_readings"].update(update["gas_readings"])
        zone_state["gas_readings"]["d_co_dt"] = d_co_dt
        zone_state["gas_readings"]["d_pressure_dt"] = d_pressure_dt
    if "permits" in update:
        zone_state["permits"] = update["permits"]
    if "maintenance_active" in update:
        zone_state["maintenance_active"] = update["maintenance_active"]
    if "shift_changeover_active" in update:
        zone_state["shift_changeover_active"] = update["shift_changeover_active"]
    if "cctv_alerts" in update:
        zone_state["cctv_alerts"] = update["cctv_alerts"]

    zone_state["timestamp"] = datetime.now().isoformat()

    try:
        req = RiskCheckRequest(
            zone=zone_name,
            gas_readings=GasReadings(**zone_state["gas_readings"]),
            permits=[PermitInfo(**p) for p in zone_state["permits"]],
            maintenance_active=zone_state["maintenance_active"],
            shift_changeover_active=zone_state["shift_changeover_active"],
            cctv_alerts=[CCTVAlert(**c) for c in zone_state.get("cctv_alerts", [])],
            timestamp=zone_state["timestamp"]
        )

        eval_result = await evaluate_risk_score(req)

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


# ---------------------------------------------------------------------------
# PERSON B — Emergency Response Orchestrator
# ---------------------------------------------------------------------------
@app.get("/api/evacuations")
def get_evacuations():
    return [e.dict() for e in evacuation_mgr.all_records()]


@app.get("/api/alerts")
def get_alerts(zone: str = None, limit: int = 50):
    return [a.dict() for a in get_alert_log(zone, limit)]


@app.get("/api/incidents")
def get_incidents(zone: str = None, limit: int = 50):
    return [r.dict() for r in get_reports(zone, limit)]


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

@app.post("/api/cctv/event")
async def trigger_cctv_event(request: CCTVAlertRequest):
    """
    Receives Computer Vision metadata alerts from active CCTV streams.
    Saves the alert into the zone state, triggers a risk re-evaluation,
    and broadcasts the updated risk metrics.
    """
    zone_name = request.zone
    if zone_name not in plant_state:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_name}' not found.")
        
    zone_state = plant_state[zone_name]
    
    # Initialize cctv_alerts list if not present
    if "cctv_alerts" not in zone_state:
        zone_state["cctv_alerts"] = []
        
    # Append the new CCTV alert
    alert_payload = {
        "zone": request.zone,
        "event_type": request.event_type,
        "confidence": request.confidence,
        "timestamp": datetime.now().isoformat()
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
        
    # Trigger risk update using the state update flow
    payload = await update_zone_state(zone_name, {"cctv_alerts": zone_state["cctv_alerts"]})
    return {
        "status": "alert_processed",
        "zone": zone_name,
        "active_cctv_alerts": zone_state["cctv_alerts"],
        "risk_assessment": payload["risk_assessment"]
    }

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
    payload_response = await update_zone_state(target_zone, {"cctv_alerts": []})
    return {
        "status": "alerts_cleared",
        "zone": target_zone,
        "active_cctv_alerts": [],
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
def audit_zone_permits(request: PermitAuditRequest):
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
def audit_all_permits():
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


@app.post("/api/collaborative-reasoning/debate", response_model=CollaborativeReasoningResponse)
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


@app.get("/api/integration/demo-scenario", response_model=DemoScenarioResponse)
def demo_scenario():
    """Curated, step-by-step narrative tying all four agents together — the script for the demo video and pitch deck."""
    return get_demo_scenario()


@app.get("/api/health")
def health():
    return {"status": "ok", "zones": list(plant_state.keys()), "rag_mode": safety_agent.vector_store.mode}
