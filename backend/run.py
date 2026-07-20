import uvicorn
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("Starting ZeroHarm AI backend server...")
    reload = os.getenv("RELOAD", "true").lower() == "true"
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if reload:
        uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True, reload_dirs=[backend_dir])
    else:
        uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)



# # # 🛡️ ZeroHarm AI Backend Run & Test Guide

# This guide provides instructions on how to run, test, and validate the **ZeroHarm AI Industrial Safety Intelligence Platform** backend. It outlines the specific JSON inputs and expected outputs for each safety scenario.

# ---

# ## 🚀 1. How to Run the Server

# ### Prerequisites & Virtual Environment Setup
# Ensure you have activated the virtual environment and have all dependencies installed.

# **For PowerShell:**
# ```powershell
# .\.venv\Scripts\Activate.ps1
# ```

# **For CMD:**
# ```cmd
# .venv\Scripts\activate.bat
# ```

# ### Start the FastAPI Server
# From the root workspace directory, run:
# ```bash
# python backend/run.py
# ```
# This launches the server at **`http://127.0.0.1:8000`** with auto-reload enabled.
# * The interactive API docs (Swagger UI) will be accessible at: [http://localhost:8000/docs](http://localhost:8000/docs).

# ---

# ## 🧪 2. How to Run the Automated Tests

# Open a new terminal (with the virtual environment activated) and run the three test scripts:

# | Test Script | Target Module | Command |
# | :--- | :--- | :--- |
# | **Test Client A** | Compound Risk & ML Detection Engine | `python backend/test_api.py` |
# | **Test Client B** | Geospatial Heatmap & Emergency Orchestrator | `python backend/test_api_b.py` |
# | **Test Client C** | Incident RAG & Compliance Audit Agent | `python backend/test_api_c.py` |

# ---

# ## 📊 3. Scenario Inputs & Expected Outputs

# Here are the precise inputs submitted to the backend and what the safety engine outputs for each scenario.

# ### Scenario 1: Clean/Normal Operations
# * **Zone**: `Blast Furnace A`
# * **Telemetry**: Standard atmospheric readings (20.8% O2, low CO, 0% Methane).
# * **Permits**: None.

# #### Input Data (`POST /risk-score`)
# ```json
# {
#   "zone": "Blast Furnace A",
#   "gas_readings": {
#     "o2": 20.8,
#     "co": 2.0,
#     "ch4_lfl": 0.0,
#     "h2s": 0.1,
#     "temperature": 28.0,
#     "pressure": 1.0
#   },
#   "permits": [],
#   "maintenance_active": false,
#   "shift_changeover_active": false,
#   "timestamp": "2026-07-16T12:00:00Z"
# }
# ```

# #### Expected Output
# ```json
# {
#   "zone": "Blast Furnace A",
#   "composite_risk_score": 6.0,
#   "risk_level": "Safe",
#   "rule_score": 5.0,
#   "ml_score": 7.6,
#   "action_required": "ROUTINE MONITORING - Standard operating procedures apply. No corrective action needed.",
#   "suspend_permits": [],
#   "factors": [
#     {
#       "name": "Normal Operations (Clean Telemetry)",
#       "score": 5.0,
#       "contribution": 100.0,
#       "details": "No active hazardous permits, no maintenance, and all sensors reporting green."
#     }
#   ]
# }
# ```

# ---

# ### Scenario 2: Methane Leak during Hot Work (Explosion Hazard)
# * **Zone**: `Coke Oven Battery 1`
# * **Telemetry**: Methane is elevated at **6.8% LFL** (above the 4% safety limit for spark-producing work).
# * **Permits**: Active hot work permit (`PTW-HW-202`).

# #### Input Data (`POST /risk-score`)
# ```json
# {
#   "zone": "Coke Oven Battery 1",
#   "gas_readings": {
#     "o2": 20.8,
#     "co": 5.0,
#     "ch4_lfl": 6.8,
#     "h2s": 0.1,
#     "temperature": 32.5,
#     "pressure": 1.02
#   },
#   "permits": [{
#     "permit_id": "PTW-HW-202",
#     "permit_type": "hot_work",
#     "status": "active",
#     "zone": "Coke Oven Battery 1",
#     "workers_count": 3
#   }],
#   "maintenance_active": false,
#   "shift_changeover_active": false,
#   "timestamp": "2026-07-16T12:00:00Z"
# }
# ```

# #### Expected Output
# ```json
# {
#   "zone": "Coke Oven Battery 1",
#   "composite_risk_score": 95.0,
#   "risk_level": "Critical",
#   "rule_score": 95.0,
#   "ml_score": 64.7,
#   "action_required": "EVACUATE AREA & HALT PERMITS - Composite risk score is critical. Safety sirens should be activated. Emergency Response Orchestrator must coordinate evacuation.",
#   "suspend_permits": ["PTW-HW-202"],
#   "factors": [
#     {
#       "name": "Explosion Hazard (CH4 Flammability)",
#       "score": 34.4,
#       "contribution": 26.6,
#       "details": "FLAMMABLE GAS DETECTED: Methane level is 6.8% LFL (Lower Flammable Limit). Explosion risk elevated."
#     },
#     {
#       "name": "Hot Work Flammable Gas Overlap",
#       "score": 95.0,
#       "contribution": 73.4,
#       "details": "CRITICAL: Active Hot Work (ignition source) in area with 6.8% LFL Methane. High risk of immediate fire/explosion. Violation of OISD-STD-105 Work Permit standards."
#     }
#   ]
# }
# ```

# ---

# ### Scenario 3: Oxygen Depletion in Confined Space (Asphyxiation Hazard)
# * **Zone**: `Sinter Plant`
# * **Telemetry**: Oxygen dropped to **16.2%** (critical asphyxiation range < 19.5% per Factories Act Sec 36) and CO elevated to **28 ppm**.
# * **Permits**: Confined space entry permit active (`PTW-CS-101`).

# #### Input Data (`POST /risk-score`)
# ```json
# {
#   "zone": "Sinter Plant",
#   "gas_readings": {
#     "o2": 16.2,
#     "co": 28.0,
#     "ch4_lfl": 0.1,
#     "h2s": 0.2,
#     "temperature": 29.0,
#     "pressure": 0.98
#   },
#   "permits": [{
#     "permit_id": "PTW-CS-101",
#     "permit_type": "confined_space",
#     "status": "active",
#     "zone": "Sinter Plant",
#     "workers_count": 2
#   }],
#   "maintenance_active": false,
#   "shift_changeover_active": false,
#   "timestamp": "2026-07-16T12:00:00Z"
# }
# ```

# #### Expected Output
# ```json
# {
#   "zone": "Sinter Plant",
#   "composite_risk_score": 92.0,
#   "risk_level": "Critical",
#   "rule_score": 92.0,
#   "action_required": "EVACUATE AREA & HALT PERMITS...",
#   "suspend_permits": ["PTW-CS-101"],
#   "factors": [
#     {
#       "name": "Asphyxiation Risk (Oxygen Deficiency)",
#       "score": 89.5,
#       "details": "ASPHYXIATION HAZARD: Oxygen level is critical at 16.2% (below 19.5% standard threshold, Factories Act Sec 36)."
#     },
#     {
#       "name": "Confined Space Compound Risk",
#       "score": 92.0,
#       "details": "CRITICAL: Active Confined Space permit overlapping with abnormal gas readings. Poor ventilation in confined spaces creates lethal hazard traps (Factories Act 1948 Section 36 compliance breach)."
#     }
#   ]
# }
# ```

# ---

# ### Scenario 4: SIMOPs Permit Clash (Simultaneous Operations Conflict)
# * **Zone**: `Coke Oven Battery 1`
# * **Telemetry**: Clean gas readings.
# * **Permits**: Both **Hot Work** and **Confined Space** entry are active in the same zone at the same time.

# #### Input Data (`POST /risk-score`)
# ```json
# {
#   "zone": "Coke Oven Battery 1",
#   "gas_readings": {
#     "o2": 20.8,
#     "co": 3.0,
#     "ch4_lfl": 0.2,
#     "h2s": 0.1,
#     "temperature": 30.0,
#     "pressure": 1.0
#   },
#   "permits": [
#     { "permit_id": "PTW-HW-202", "permit_type": "hot_work", "status": "active", "zone": "Coke Oven Battery 1" },
#     { "permit_id": "PTW-CS-303", "permit_type": "confined_space", "status": "active", "zone": "Coke Oven Battery 1" }
#   ],
#   "maintenance_active": false,
#   "shift_changeover_active": false,
#   "timestamp": "2026-07-16T12:00:00Z"
# }
# ```

# #### Expected Output
# ```json
# {
#   "zone": "Coke Oven Battery 1",
#   "composite_risk_score": 80.0,
#   "risk_level": "Critical",
#   "factors": [
#     {
#       "name": "SIMOPs (Simultaneous Operations) Hazard",
#       "score": 15.0,
#       "details": "SIMOPs Conflict: Hot Work (ignition) and Confined Space (toxic hazard) active simultaneously..."
#     }
#   ]
# }
# ```

# ---

# ### Scenario 5: Historical & Statutory Query (RAG Agent)
# * **Query**: `"Have we seen a Carbon Monoxide leak during shift changeover before?"`

# #### Input Data (`POST /api/rag/query`)
# ```json
# {
#   "query": "Have we seen a Carbon Monoxide leak during shift changeover before?"
# }
# ```

# #### Expected Output
# * **Mode**: `"TF-IDF (Local Fallback)"` (or `"ChromaDB + Google Embeddings"` if online)
# * **Sources**: Lists matches like `Historical Incident: Coke Oven CO Poisoning Case (April 2025)`.
# * **Answer**: Returns a markdown response highlighting the April 2025 Coke Oven accident where a shift handover overlap with maintenance caused a toxic CO leak (85 ppm), violating the Factories Act Section 36.

# ---

# ### Scenario 6: Compliance Audit
# * **Zone**: `Sinter Plant`
# * **Telemetry**: low oxygen (16.5% O2) & active confined space permit.

# #### Input Data (`POST /api/compliance/audit`)
# ```json
# {
#   "zone": "Sinter Plant",
#   "telemetry": {
#     "o2": 16.5,
#     "co": 35.0,
#     "ch4_lfl": 0.1,
#     "h2s": 0.2
#   },
#   "permits": [
#     { "permit_id": "PTW-CS-101", "permit_type": "confined_space", "status": "active" }
#   ],
#   "maintenance_active": true,
#   "shift_changeover_active": false
# }
# ```

# #### Expected Output
# * A detailed audit report highlighting compliance gaps:
#   - ❌ **Factories Act 1948 - Section 36 Deviation**: Confined space atmosphere is deficient in oxygen (< 19.5%).
#   - ❌ **OISD-GDN-137 Gas Alarm Deviation**: Carbon Monoxide limits exceeded (> 25 ppm).
#   - **Recommendations**: Immediate ventilation, permit suspension, and standby rescue monitors.
