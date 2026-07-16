"""
Test client for Temporal Time-Series Rate of Change checks.

This script tests that:
  1. Sending sequential telemetry updates with rapid CO accumulation 
     triggers the 'CO Rapid Accumulation Anomaly' warning factor.
  2. Sending sequential telemetry updates with rapid pressure buildup
     triggers the 'Rapid Pressure Buildup' anomaly factor.

Make sure the FastAPI server is running on http://127.0.0.1:8000 before running:
    python backend/test_temporal.py
"""

import urllib.request
import json
import time

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
    print("ZeroHarm AI - Temporal Rate-of-Change Telemetry Test Client")
    print("Connecting to http://127.0.0.1:8000 ...")
    
    # 1. Reset Coke Oven Battery 1 to baseline normal
    section("1. Reset Coke Oven Battery 1 state")
    reset_data = {
        "gas_readings": {"o2": 20.8, "co": 2.5, "ch4_lfl": 0.1, "h2s": 0.2, "temperature": 29.5, "pressure": 1.01},
        "permits": [],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "cctv_alerts": []
    }
    res = call_api("/api/state/update?zone_name=Coke%20Oven%20Battery%201", data=reset_data)
    if res:
        print("Zone reset to normal.")

    # 2. Simulate rapid CO leak over 3 ticks
    section("2. Simulating Rapid Carbon Monoxide Build-Up (Leak)")
    co_values = [5.0, 15.0, 28.0]
    
    for i, co in enumerate(co_values):
        print(f"\nTick {i+1}: Sending CO = {co} ppm")
        update_data = {
            "gas_readings": {"o2": 20.8, "co": co, "ch4_lfl": 0.1, "h2s": 0.2, "temperature": 29.5, "pressure": 1.01}
        }
        res = call_api("/api/state/update?zone_name=Coke%20Oven%20Battery%201", data=update_data)
        if res:
            risk = res["risk_assessment"]
            gas = res["state"]["gas_readings"]
            print(f" -> Recorded rates: d_co/dt = {gas.get('d_co_dt')} ppm/s | d_press/dt = {gas.get('d_pressure_dt')} bar/s")
            print(f" -> Composite Risk Score: {risk['composite_risk_score']} (Level: {risk['risk_level']})")
            
            # Print flagged factors
            factors = [f["name"] for f in risk.get("factors", [])]
            if factors:
                print(f" -> Flagged Factors: {factors}")
        
        # Sleep short window to simulate tick interval
        time.sleep(1.0)

    # 3. Simulate rapid pressure buildup
    section("3. Simulating Rapid Pressure Buildup Anomaly (Containment Failure)")
    pressure_values = [1.02, 1.09, 1.16]
    
    for i, press in enumerate(pressure_values):
        print(f"\nTick {i+1}: Sending Pressure = {press} bar")
        update_data = {
            "gas_readings": {"o2": 20.8, "co": 2.0, "ch4_lfl": 0.1, "h2s": 0.2, "temperature": 29.5, "pressure": press}
        }
        res = call_api("/api/state/update?zone_name=Coke%20Oven%20Battery%201", data=update_data)
        if res:
            risk = res["risk_assessment"]
            gas = res["state"]["gas_readings"]
            print(f" -> Recorded rates: d_co/dt = {gas.get('d_co_dt')} ppm/s | d_press/dt = {gas.get('d_pressure_dt')} bar/s")
            print(f" -> Composite Risk Score: {risk['composite_risk_score']} (Level: {risk['risk_level']})")
            
            # Print flagged factors
            factors = [f["name"] for f in risk.get("factors", [])]
            if factors:
                print(f" -> Flagged Factors: {factors}")
                
        time.sleep(1.0)
