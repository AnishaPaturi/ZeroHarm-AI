"""
Test client for Computer Vision & CCTV Analytics Integration.

This script tests the new CCTV metadata endpoints:
  1. POST /api/cctv/event - Trigger a CCTV alert
  2. POST /api/cctv/clear - Clear alerts in a zone

Make sure the FastAPI server is running on http://127.0.0.1:8000 before running:
    python backend/test_cctv.py
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
    print("ZeroHarm AI - Computer Vision CCTV Analytics Test Client")
    print("Connecting to http://127.0.0.1:8000 ...")
    
    # Check baseline state
    section("1. Baseline State (Coke Oven Battery 1)")
    baseline = call_api("/api/state", method="GET")
    if not baseline:
        print("ERROR: Is the FastAPI server running?")
        exit(1)
        
    coke_oven = baseline.get("Coke Oven Battery 1", {})
    print(f"Initial CCTV alerts: {coke_oven.get('cctv_alerts')}")
    
    # 1. Trigger PPE violation alert
    section("2. Trigger PPE Alert (No helmet/harness)")
    ppe_data = {
        "zone": "Coke Oven Battery 1",
        "event_type": "no_ppe",
        "confidence": 0.85
    }
    res = call_api("/api/cctv/event", data=ppe_data)
    if res:
        risk = res["risk_assessment"]
        print(f"Status: {res['status']}")
        print(f"Composite Risk Score: {risk['composite_risk_score']} (Level: {risk['risk_level']})")
        print("Factors flagged:")
        for factor in risk.get("factors", []):
            print(f" - [{factor['name']}] Score: {factor['score']} | {factor['details']}")
            
    # 2. Trigger Fire/Smoke alert
    section("3. Trigger Fire Alert (Suspends Hot Work)")
    fire_data = {
        "zone": "Coke Oven Battery 1",
        "event_type": "fire_detected",
        "confidence": 0.95
    }
    res2 = call_api("/api/cctv/event", data=fire_data)
    if res2:
        risk = res2["risk_assessment"]
        print(f"Status: {res2['status']}")
        print(f"Composite Risk Score: {risk['composite_risk_score']} (Level: {risk['risk_level']})")
        print(f"Permits suspended: {risk.get('suspend_permits')}")
        print("Factors flagged:")
        for factor in risk.get("factors", []):
            print(f" - [{factor['name']}] Score: {factor['score']} | {factor['details']}")
            
    # 3. Clear CCTV alerts
    section("4. Clear CCTV Alerts")
    res3 = call_api(f"/api/cctv/clear?zone=Coke%20Oven%20Battery%201", method="POST")
    if res3:
        risk = res3["risk_assessment"]
        print(f"Status: {res3['status']}")
        print(f"Active CCTV alerts: {res3['active_cctv_alerts']}")
        print(f"Composite Risk Score returned to: {risk['composite_risk_score']} (Level: {risk['risk_level']})")
