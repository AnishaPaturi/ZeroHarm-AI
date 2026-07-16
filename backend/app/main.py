from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
import numpy as np
from datetime import datetime
from typing import List, Dict, Any

from .engine.models import RiskCheckRequest, RiskCheckResponse, GasReadings, PermitInfo, FactorRisk
from .engine.rules import evaluate_rules
from .engine.ml_anomaly import CompoundRiskMLModel

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
from .orchestrator.alert_channels import get_alert_log

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("sentinelsafe")

app = FastAPI(
    title="SentinelSafe — Industrial Safety Intelligence Platform",
    description="Fuses real-time gas telemetry, permits, and operational status into a compound risk score "
                "(Person A), then projects that risk onto the plant layout and drives evacuation/alert "
                "workflows (Person B).",
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


def _on_incident_needed(zone: str, risk_assessment: dict, evacuation_record):
    report = generate_report(zone, risk_assessment, evacuation_record)
    logger.warning(f"Preliminary incident report generated: {report.report_id} for zone '{zone}'")


evacuation_mgr = EvacuationManager(worker_simulator=worker_sim, incident_report_generator=_on_incident_needed)


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
        "timestamp": datetime.now().isoformat()
    },
    "Blast Furnace A": {
        "zone": "Blast Furnace A",
        "gas_readings": {"o2": 20.9, "co": 5.0, "ch4_lfl": 0.2, "h2s": 0.1, "temperature": 32.0, "pressure": 1.05},
        "permits": [{"permit_id": "PTW-2026-004", "permit_type": "cold_work", "status": "active",
                     "zone": "Blast Furnace A", "workers_count": 2}],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "timestamp": datetime.now().isoformat()
    },
    "Sinter Plant": {
        "zone": "Sinter Plant",
        "gas_readings": {"o2": 20.8, "co": 1.0, "ch4_lfl": 0.0, "h2s": 0.0, "temperature": 27.0, "pressure": 0.99},
        "permits": [{"permit_id": "PTW-2026-002", "permit_type": "confined_space", "status": "active",
                     "zone": "Sinter Plant", "workers_count": 2}],
        "maintenance_active": True,
        "shift_changeover_active": False,
        "timestamp": datetime.now().isoformat()
    },
    "Ammonia Storage Tank": {
        "zone": "Ammonia Storage Tank",
        "gas_readings": {"o2": 20.8, "co": 0.5, "ch4_lfl": 0.0, "h2s": 1.5, "temperature": 25.0, "pressure": 1.10},
        "permits": [{"permit_id": "PTW-2026-003", "permit_type": "height_work", "status": "active",
                     "zone": "Ammonia Storage Tank", "workers_count": 4}],
        "maintenance_active": False,
        "shift_changeover_active": False,
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


@app.post("/risk-score", response_model=RiskCheckResponse)
async def evaluate_risk_score(request: RiskCheckRequest):
    """
    Stateless endpoint to compute the composite risk score of a given zone configuration.
    Fuses deterministic compliance rules with ML anomaly detection, then feeds the
    result into Person B's geospatial heatmap + emergency orchestrator.
    """
    try:
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

        risk_history.append(response.dict())
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
        zone_state["gas_readings"].update(update["gas_readings"])
    if "permits" in update:
        zone_state["permits"] = update["permits"]
    if "maintenance_active" in update:
        zone_state["maintenance_active"] = update["maintenance_active"]
    if "shift_changeover_active" in update:
        zone_state["shift_changeover_active"] = update["shift_changeover_active"]

    zone_state["timestamp"] = datetime.now().isoformat()

    try:
        req = RiskCheckRequest(
            zone=zone_name,
            gas_readings=GasReadings(**zone_state["gas_readings"]),
            permits=[PermitInfo(**p) for p in zone_state["permits"]],
            maintenance_active=zone_state["maintenance_active"],
            shift_changeover_active=zone_state["shift_changeover_active"],
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


@app.get("/api/health")
def health():
    return {"status": "ok", "zones": list(plant_state.keys())}
