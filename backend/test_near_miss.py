"""
Test client for Near Miss Prediction (Innovation 5).

This script tests:
  1. Sending sequential CCTV 'unauthorized_entry' alerts to Coke Oven Battery 1.
  2. Verifying that the entry count increases.
  3. Verifying that the rules engine raises the composite risk score and adds the Near Miss factor.
  4. Verifying that the /api/near-misses endpoint reports the prediction of High probability of incident within next shift.
  5. Clearing CCTV alerts resets the near-miss counters.

Make sure the FastAPI server is running on http://127.0.0.1:8000 before running:
    python backend/test_near_miss.py
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
    print("ZeroHarm AI - Near Miss Prediction Test Client")
    print("Connecting to http://127.0.0.1:8000 ...")
    
    # 1. Reset Coke Oven Battery 1 to baseline normal
    section("1. Reset Coke Oven Battery 1 state")
    res_clear = call_api("/api/cctv/clear?zone=Coke%20Oven%20Battery%201", method="POST")
    if res_clear:
        print("Zone cleared and reset.")
    
    # 2. Trigger first unauthorized entry
    section("2. Trigger First Unauthorized Entry (CCTV Alert)")
    entry1 = {
        "zone": "Coke Oven Battery 1",
        "event_type": "unauthorized_entry",
        "confidence": 0.91,
        "worker_id": "W-001",
        "worker_name": "Arjun"
    }
    res_entry1 = call_api("/api/cctv/event", data=entry1)
    if res_entry1:
        print(f"Recorded entry count: {res_entry1.get('restricted_entry_count')}")
        risk = res_entry1["risk_assessment"]
        print(f"Composite Risk Score: {risk['composite_risk_score']} (Level: {risk['risk_level']})")
        print("Active Factors:")
        for f in risk.get("factors", []):
            print(f" - [{f['name']}] Score: {f['score']}")
            
    # 3. Trigger second unauthorized entry
    section("3. Trigger Second Unauthorized Entry (CCTV Alert) -> Predict Near Miss")
    entry2 = {
        "zone": "Coke Oven Battery 1",
        "event_type": "unauthorized_entry",
        "confidence": 0.88,
        "worker_id": "W-001",
        "worker_name": "Arjun"
    }
    res_entry2 = call_api("/api/cctv/event", data=entry2)
    if res_entry2:
        print(f"Recorded entry count: {res_entry2.get('restricted_entry_count')}")
        risk = res_entry2["risk_assessment"]
        print(f"Composite Risk Score: {risk['composite_risk_score']} (Level: {risk['risk_level']})")
        print("Active Factors:")
        for f in risk.get("factors", []):
            print(f" - [{f['name']}] Score: {f['score']}")
            print(f"   Details: {f['details']}")

    # 4. Fetch the near misses predictions list
    section("4. Fetch Predicted Near Misses from API")
    predictions = call_api("/api/near-misses", method="GET")
    if predictions is not None:
        print(f"Found {len(predictions)} near miss predictions:")
        for p in predictions:
            print(f" - Zone: {p['zone']}")
            print(f"   Entries Count: {p['unauthorized_entries_count']}")
            print(f"   Prediction: {p['prediction']}")
            print(f"   Probability: {p['predicted_incident_probability']}%")
            print(f"   Recommendation: {p['recommendation']}")
            print(f"   Worker Name: {p['last_worker_name']} (ID: {p['last_worker_id']})")
            
    # 5. Clear alerts and check reset
    section("5. Clear CCTV alerts and verify reset")
    res_clear2 = call_api("/api/cctv/clear?zone=Coke%20Oven%20Battery%201", method="POST")
    if res_clear2:
        print("Zone cleared.")
        predictions_after = call_api("/api/near-misses", method="GET")
        print(f"Near miss predictions count after clear: {len(predictions_after) if predictions_after is not None else 0}")
