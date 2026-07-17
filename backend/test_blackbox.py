"""
Test client for Person B Evacuation Evidence Preservation ("Black Box Logging").

This script:
  1. Updates the state of Coke Oven Battery 1 several times to build telemetry history.
  2. Triggers an evacuation (by posting a critical risk score condition).
  3. Checks that an incident report was generated and contains a sealed JSON file path.
  4. Verifies the sealed JSON file exists, is read-only, and contains the historical ticks.

Make sure the FastAPI server is running on http://127.0.0.1:8000 before running:
    python backend/test_blackbox.py
"""

import urllib.request
import json
import time
import os
import stat

BASE_URL = "http://127.0.0.1:8000"

def call_api(endpoint, data=None, method="POST"):
    url = f"{BASE_URL}{endpoint}"
    req_body = json.dumps(data).encode("utf-8") if data else None
    
    req = urllib.request.Request(
        url,
        data=req_body,
        headers={"Content-Type": "application/json"} if req_body else {},
        method=method
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.read().decode('utf-8')}")
        return None
    except Exception as e:
        print(f"Error connecting: {e}")
        return None

def section(title):
    print(f"\n==================================================")
    print(f"{title.upper()}")
    print(f"==================================================")

if __name__ == "__main__":
    print("ZeroHarm AI - Black Box Evidence Preservation Test Client")
    
    # 1. Reset Coke Oven Battery 1 to baseline normal
    section("1. Simulating running telemetry ticks")
    telemetry_ticks = [
        {"co": 2.0, "pressure": 1.01},
        {"co": 5.0, "pressure": 1.02},
        {"co": 10.0, "pressure": 1.03},
        {"co": 12.0, "pressure": 1.04}
    ]
    
    for i, tick in enumerate(telemetry_ticks):
        print(f"Sending telemetry tick {i+1}: CO={tick['co']} ppm, Pressure={tick['pressure']} bar")
        state_data = {
            "gas_readings": {
                "o2": 20.8,
                "co": tick["co"],
                "ch4_lfl": 0.0,
                "h2s": 0.1,
                "temperature": 30.0,
                "pressure": tick["pressure"]
            },
            "permits": [],
            "maintenance_active": False,
            "shift_changeover_active": False,
            "cctv_alerts": []
        }
        res = call_api("/api/state/update?zone_name=Coke%20Oven%20Battery%201", data=state_data)
        time.sleep(0.5)

    # 2. Trigger high risk to fire evacuation
    section("2. Triggering Evacuation Scenario")
    critical_state = {
        "gas_readings": {
            "o2": 15.0,  # Asphyxiation hazard
            "co": 95.0,  # Lethal CO
            "ch4_lfl": 15.0,
            "h2s": 25.0,
            "temperature": 55.0,
            "pressure": 1.45
        }
    }
    print("Sending critical gas leak telemetry to trigger immediate evacuation...")
    res = call_api("/api/state/update?zone_name=Coke%20Oven%20Battery%201", data=critical_state)
    if res:
        print(f"Zone state updated. Risk Score: {res['risk_assessment']['composite_risk_score']}")

    # Wait for RAG generation and async tasks to complete
    time.sleep(1.0)

    # 3. Retrieve generated reports
    section("3. Retrieving Incident Reports")
    reports = call_api("/api/incidents", method="GET")
    if not reports:
        print("ERROR: No incident reports generated!")
        exit(1)
        
    latest_report = reports[-1]
    print(f"Latest Report ID: {latest_report['report_id']}")
    print(f"Affected Zone: {latest_report['zone']}")
    print(f"Composite Risk Score: {latest_report['composite_risk_score']}")
    print(f"Evacuation Status: {latest_report['evacuation_status']}")
    print(f"Evidence Sealed File Path: {latest_report.get('evidence_file_path')}")
    print(f"Narrative Summary: {latest_report['narrative']}")

    # 4. Verify Black Box File on Filesystem
    section("4. Verifying Flight Data Recorder Block File")
    filepath = latest_report.get('evidence_file_path')
    if not filepath or not os.path.exists(filepath):
        print(f"ERROR: Black box file not found on disk at: {filepath}")
        exit(1)
        
    print(f"Sealed file found on disk.")
    
    # Check if read-only
    file_stat = os.stat(filepath)
    is_readonly = not (file_stat.st_mode & stat.S_IWRITE)
    print(f"Is file marked read-only? {is_readonly}")
    
    # Read contents
    with open(filepath, "r") as f:
        evidence = json.load(f)
        
    print("\n--- SEALED EVIDENCE PACKAGE METADATA ---")
    print(json.dumps(evidence["metadata"], indent=2))
    print(f"\nNumber of sensor frames captured: {len(evidence['sensor_history'])}")
    print("Preceding sensor frames:")
    for frame in evidence['sensor_history']:
        print(f"  - Timestamp: {frame['timestamp']} | CO: {frame['gas_readings']['co']} ppm | Press: {frame['gas_readings']['pressure']} bar | Risk Score: {frame['composite_score']}")
