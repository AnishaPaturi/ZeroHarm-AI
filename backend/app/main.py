from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import logging
from datetime import datetime
from typing import List, Dict, Any

from .engine.models import RiskCheckRequest, RiskCheckResponse, GasReadings, PermitInfo, FactorRisk
from .engine.rules import evaluate_rules
from .engine.ml_anomaly import CompoundRiskMLModel

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("risk_engine")

app = FastAPI(
    title="SentinelSafe Compound Risk Detection Engine",
    description="Fuses real-time gas telemetry, active permit configurations, and operational status to calculate compound risks.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
ml_model = CompoundRiskMLModel()
risk_history: List[Dict[str, Any]] = []
MAX_HISTORY_LEN = 100

# WebSocket Connections Manager
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

# In-Memory Plant State for Simulation
plant_state: Dict[str, Dict[str, Any]] = {
    "Coke Oven Battery 1": {
        "zone": "Coke Oven Battery 1",
        "gas_readings": {
            "o2": 20.8,
            "co": 2.5,
            "ch4_lfl": 0.1,
            "h2s": 0.2,
            "temperature": 29.5,
            "pressure": 1.01
        },
        "permits": [
            {
                "permit_id": "PTW-2026-001",
                "permit_type": "hot_work",
                "status": "active",
                "zone": "Coke Oven Battery 1",
                "workers_count": 3
            }
        ],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "timestamp": datetime.now().isoformat()
    },
    "Blast Furnace A": {
        "zone": "Blast Furnace A",
        "gas_readings": {
            "o2": 20.9,
            "co": 5.0,
            "ch4_lfl": 0.2,
            "h2s": 0.1,
            "temperature": 32.0,
            "pressure": 1.05
        },
        "permits": [
            {
                "permit_id": "PTW-2026-004",
                "permit_type": "cold_work",
                "status": "active",
                "zone": "Blast Furnace A",
                "workers_count": 2
            }
        ],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "timestamp": datetime.now().isoformat()
    },
    "Sinter Plant": {
        "zone": "Sinter Plant",
        "gas_readings": {
            "o2": 20.8,
            "co": 1.0,
            "ch4_lfl": 0.0,
            "h2s": 0.0,
            "temperature": 27.0,
            "pressure": 0.99
        },
        "permits": [
            {
                "permit_id": "PTW-2026-002",
                "permit_type": "confined_space",
                "status": "active",
                "zone": "Sinter Plant",
                "workers_count": 2
            }
        ],
        "maintenance_active": True,
        "shift_changeover_active": False,
        "timestamp": datetime.now().isoformat()
    },
    "Ammonia Storage Tank": {
        "zone": "Ammonia Storage Tank",
        "gas_readings": {
            "o2": 20.8,
            "co": 0.5,
            "ch4_lfl": 0.0,
            "h2s": 1.5,
            "temperature": 25.0,
            "pressure": 1.10
        },
        "permits": [
            {
                "permit_id": "PTW-2026-003",
                "permit_type": "height_work",
                "status": "active",
                "zone": "Ammonia Storage Tank",
                "workers_count": 4
            }
        ],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "timestamp": datetime.now().isoformat()
    }
}

# Startup Event: Train ML models
@app.on_event("startup")
async def startup_event():
    logger.info("Initializing risk engine ML models...")
    # Run training in background thread to avoid blocking FastAPI startup
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, ml_model.train)
    logger.info("Startup complete.")

# Blend Rules Score and ML Anomaly Score
def blend_risk_scores(rule_score: float, ml_score: float, factors: List[FactorRisk]) -> float:
    # 1. Deterministic Safety Override:
    # If rules identify a CRITICAL risk (e.g. O2 deficiency in confined space, CH4 during welding),
    # we honor the rules engine fully for safety clearance.
    is_critical_override = any(
        "CRITICAL" in f.details or "ASPHYXIATION" in f.details or "FLAMMABLE GAS DETECTED" in f.details or "Explosion Hazard" in f.name or "Toxic" in f.name 
        for f in factors
    )
    if is_critical_override or rule_score >= 80.0:
        return max(rule_score, ml_score)

    # 2. Pattern Anomaly Inflation:
    # If ML detects a highly anomalous configuration (e.g., O2 slightly dropping, CO slightly rising,
    # during shift handover, which rules don't fully flag as critical yet),
    # we inflate the composite score to raise warning.
    if ml_score > 60.0 and rule_score < 40.0:
        return round(0.5 * rule_score + 0.5 * ml_score, 1)

    # 3. Standard Blend (60% Rules, 40% ML)
    return round(0.6 * rule_score + 0.4 * ml_score, 1)

# Core Endpoint: /risk-score (Stateless Evaluation)
@app.post("/risk-score", response_model=RiskCheckResponse)
def evaluate_risk_score(request: RiskCheckRequest):
    """
    Stateless endpoint to compute the composite risk score of a given zone configuration.
    Fuses deterministic compliance rules with ML anomaly detection.
    """
    try:
        # 1. Evaluate rules (deterministic)
        rule_score, risk_level, factors, suspend_permits = evaluate_rules(request)
        
        # 2. Evaluate ML anomaly
        # Convert request to dict format expected by ML model
        req_dict = request.dict()
        rf_prob, if_score = ml_model.predict(req_dict)
        # ML score is the average of Random Forest probability and Isolation Forest anomaly score
        ml_score = round((rf_prob + if_score) / 2.0, 1)
        
        # 3. Blend scores
        composite_score = blend_risk_scores(rule_score, ml_score, factors)
        
        # Recalculate Risk Level based on blended score
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
        
        # Add to local history
        risk_history.append(response.dict())
        if len(risk_history) > MAX_HISTORY_LEN:
            risk_history.pop(0)
            
        return response

    except Exception as e:
        logger.error(f"Error evaluating risk score: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Stateful API: Get current plant state
@app.get("/api/state")
def get_plant_state():
    """Returns the current simulated telemetry, permits, and statuses for all plant zones."""
    return plant_state

# Stateful API: Update zone state & broadcast live risk feed
@app.post("/api/state/update")
async def update_zone_state(zone_name: str, update: Dict[str, Any]):
    """
    Updates the state of a specific zone, evaluates the new risk,
    and broadcasts the updated status to all live websocket listeners.
    """
    if zone_name not in plant_state:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_name}' not found.")
        
    # Update state fields
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
    
    # Calculate new risk score
    try:
        # Create RiskCheckRequest object
        req = RiskCheckRequest(
            zone=zone_name,
            gas_readings=GasReadings(**zone_state["gas_readings"]),
            permits=[PermitInfo(**p) for p in zone_state["permits"]],
            maintenance_active=zone_state["maintenance_active"],
            shift_changeover_active=zone_state["shift_changeover_active"],
            timestamp=zone_state["timestamp"]
        )
        
        # Run evaluation
        eval_result = evaluate_risk_score(req)
        
        # Attach risk assessment to the broadcast message
        payload = {
            "event": "risk_update",
            "zone": zone_name,
            "state": zone_state,
            "risk_assessment": eval_result.dict()
        }
        
        # Broadcast to websockets
        await manager.broadcast(payload)
        
        return payload
    except Exception as e:
        logger.error(f"Error updating zone state: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Stateful API: Get risk history
@app.get("/api/risk-history")
def get_risk_history(limit: int = 50, zone: str = None):
    """Retrieves the history of risk calculations, optionally filtered by zone."""
    history = risk_history
    if zone:
        history = [r for r in history if r["zone"] == zone]
    return history[-limit:]

# Simulation Tick Endpoint: Advances the state of the plant to simulate real-world changes
simulation_step = 0
@app.post("/api/simulate/tick")
async def simulation_tick():
    """
    Advances the plant state to simulate real-time sensor fluctuations, permit modifications, 
    and safety incidents (ideal for UI testing and demos).
    """
    global simulation_step
    simulation_step += 1
    
    updates = []
    
    # Step 1: Normal fluctuations for Sinter Plant and Ammonia Storage
    # Sinter Plant (Confined space entry)
    sinter_gas = plant_state["Sinter Plant"]["gas_readings"].copy()
    sinter_gas["o2"] = round(max(19.0, min(21.2, sinter_gas["o2"] + np.random.uniform(-0.1, 0.08))), 2)
    sinter_gas["co"] = round(max(0, sinter_gas["co"] + np.random.uniform(-0.5, 0.8)), 1)
    updates.append(await update_zone_state("Sinter Plant", {"gas_readings": sinter_gas}))
    
    # Ammonia Storage (Height work)
    ammonia_gas = plant_state["Ammonia Storage Tank"]["gas_readings"].copy()
    ammonia_gas["h2s"] = round(max(0, ammonia_gas["h2s"] + np.random.uniform(-0.2, 0.3)), 1)
    updates.append(await update_zone_state("Ammonia Storage Tank", {"gas_readings": ammonia_gas}))

    # Step 2: Trigger progressive incident patterns in Zone 1 (Coke Oven Battery 1) & Zone 2 (Blast Furnace A)
    # This simulation cycles through safe -> warnings -> critical anomalies -> safety shutdowns
    cycle = simulation_step % 12
    
    if cycle == 0:
        # Reset state to safe
        logger.info("Simulation Cycle Reset: All systems normal.")
        co_gas = {
            "o2": 20.8, "co": 2.0, "ch4_lfl": 0.0, "h2s": 0.1, "temperature": 29.0, "pressure": 1.0
        }
        bf_gas = {
            "o2": 20.9, "co": 4.0, "ch4_lfl": 0.1, "h2s": 0.0, "temperature": 31.0, "pressure": 1.04
        }
        updates.append(await update_zone_state("Coke Oven Battery 1", {
            "gas_readings": co_gas,
            "permits": [{
                "permit_id": "PTW-2026-001", "permit_type": "hot_work", "status": "active",
                "zone": "Coke Oven Battery 1", "workers_count": 3
            }],
            "maintenance_active": False,
            "shift_changeover_active": False
        }))
        updates.append(await update_zone_state("Blast Furnace A", {
            "gas_readings": bf_gas,
            "permits": [],
            "maintenance_active": False,
            "shift_changeover_active": False
        }))
        
    elif cycle == 1:
        # Zone 1: Gas starts slightly building up (CO rises)
        co_gas = plant_state["Coke Oven Battery 1"]["gas_readings"].copy()
        co_gas["co"] = 28.0 # Normal is < 25, so this triggers warning
        updates.append(await update_zone_state("Coke Oven Battery 1", {"gas_readings": co_gas}))
        
    elif cycle == 2:
        # Zone 2: Maintenance window opens + Shift changeover begins
        updates.append(await update_zone_state("Blast Furnace A", {
            "maintenance_active": True,
            "shift_changeover_active": True
        }))
        
    elif cycle == 3:
        # Zone 1: Hot Work welding active + Methane begins leaking (CH4 LFL rises)
        co_gas = plant_state["Coke Oven Battery 1"]["gas_readings"].copy()
        co_gas["ch4_lfl"] = 4.2 # Warning threshold (4% LFL) during hot work
        updates.append(await update_zone_state("Coke Oven Battery 1", {"gas_readings": co_gas}))
        
    elif cycle == 4:
        # Zone 1: Methane breaches critical welding safety limits! (SIMOPs conflict / critical breach)
        co_gas = plant_state["Coke Oven Battery 1"]["gas_readings"].copy()
        co_gas["ch4_lfl"] = 6.5 # Extreme flammability risk with hot work
        updates.append(await update_zone_state("Coke Oven Battery 1", {"gas_readings": co_gas}))
        
    elif cycle == 5:
        # Zone 1: Emergency shutdown! Permit automatically suspended
        permits = plant_state["Coke Oven Battery 1"]["permits"].copy()
        for p in permits:
            p["status"] = "suspended"
        # Gas decreases slightly due to emergency vents activating
        co_gas = plant_state["Coke Oven Battery 1"]["gas_readings"].copy()
        co_gas["ch4_lfl"] = 2.5
        co_gas["co"] = 15.0
        updates.append(await update_zone_state("Coke Oven Battery 1", {
            "permits": permits,
            "gas_readings": co_gas
        }))
        
    elif cycle == 6:
        # Zone 2: Blast Furnace pressure and CO spike during maintenance changeover
        bf_gas = plant_state["Blast Furnace A"]["gas_readings"].copy()
        bf_gas["co"] = 55.0 # Toxic CO leak
        bf_gas["pressure"] = 1.6 # High pressure
        updates.append(await update_zone_state("Blast Furnace A", {"gas_readings": bf_gas}))
        
    elif cycle == 7:
        # Zone 2: Critical alert escalation
        bf_gas = plant_state["Blast Furnace A"]["gas_readings"].copy()
        bf_gas["co"] = 110.0 # Extreme lethal toxicity
        updates.append(await update_zone_state("Blast Furnace A", {"gas_readings": bf_gas}))
        
    elif cycle == 8:
        # Zone 2: Maintenance completed, venting active, safety restored
        bf_gas = {
            "o2": 20.8, "co": 8.0, "ch4_lfl": 0.1, "h2s": 0.0, "temperature": 29.5, "pressure": 1.02
        }
        updates.append(await update_zone_state("Blast Furnace A", {
            "gas_readings": bf_gas,
            "maintenance_active": False,
            "shift_changeover_active": False
        }))
        
    elif cycle == 9:
        # Zone 3: Sinter Plant confined space O2 levels begin to deplete
        sinter_gas = plant_state["Sinter Plant"]["gas_readings"].copy()
        sinter_gas["o2"] = 18.2 # Low oxygen warning
        updates.append(await update_zone_state("Sinter Plant", {"gas_readings": sinter_gas}))
        
    elif cycle == 10:
        # Zone 3: Sinter Plant O2 level drops below life safety limit! Confined space entry breach
        sinter_gas = plant_state["Sinter Plant"]["gas_readings"].copy()
        sinter_gas["o2"] = 16.5 # Asphyxiation hazard
        sinter_gas["co"] = 35.0 # Elevated CO toxicity
        updates.append(await update_zone_state("Sinter Plant", {"gas_readings": sinter_gas}))
        
    elif cycle == 11:
        # Zone 3: Sinter Plant evacuation ordered, vents active, permit suspended
        permits = plant_state["Sinter Plant"]["permits"].copy()
        for p in permits:
            p["status"] = "suspended"
        sinter_gas = plant_state["Sinter Plant"]["gas_readings"].copy()
        sinter_gas["o2"] = 20.2
        sinter_gas["co"] = 8.0
        updates.append(await update_zone_state("Sinter Plant", {
            "permits": permits,
            "gas_readings": sinter_gas
        }))

    return {
        "simulation_step": simulation_step,
        "cycle_index": cycle,
        "updates": [u["risk_assessment"] for u in updates]
    }

# WebSocket Endpoint
@app.websocket("/ws/risk-feed")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial state upon connection
        initial_payload = {
            "event": "initial_state",
            "state": plant_state,
            "history": risk_history[-10:]
        }
        await websocket.send_json(initial_payload)
        
        while True:
            # Keep connection alive, listen for any client messages
            data = await websocket.receive_text()
            # Echo or process if needed, for now just log
            logger.info(f"Received message from client: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
