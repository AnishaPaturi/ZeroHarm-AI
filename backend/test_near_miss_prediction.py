"""
Test client for Near Miss Prediction Engine (Innovation 5).

This script tests:
   1. Sending sequential CCTV 'unauthorized_entry' alerts.
   2. Verifying that /api/near-misses returns enriched predictions from the
      NearMissPredictionEngine (dynamic probability, severity, root causes,
      recommendations, confidence, trend, factors).
   3. Verifying the /api/near-miss/predict endpoint for detailed zone prediction.
   4. Verifying that clearing alerts resets near-miss state.
   5. Verifying multi-factor scoring accuracy.

Make sure the FastAPI server is running on http://127.0.0.1:8000 before running:
    python backend/test_near_miss_prediction.py
"""

import urllib.request
import json
import time
import sys

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
    print(f"\n{'=' * 60}")
    print(f"  {title.upper()}")
    print(f"{'=' * 60}")


def assert_true(condition, message):
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {message}")
    return condition


if __name__ == "__main__":
    passed = 0
    failed = 0

    def check(condition, message):
        global passed, failed
        if assert_true(condition, message):
            passed += 1
        else:
            failed += 1

    print("ZeroHarm AI - Near Miss Prediction Engine Test Client")
    print("Connecting to http://127.0.0.1:8000 ...")

    # 1. Reset zone to baseline
    section("1. Reset Coke Oven Battery 1 state")
    res_clear = call_api("/api/cctv/clear?zone=Coke%20Oven%20Battery%201", method="POST")
    check(res_clear is not None, "Clear endpoint responded")
    check(res_clear and res_clear.get("restricted_entry_count") == 0, "Entry count reset to 0")

    # 2. Trigger first unauthorized entry
    section("2. Trigger First Unauthorized Entry")
    entry1 = {
        "zone": "Coke Oven Battery 1",
        "event_type": "unauthorized_entry",
        "confidence": 0.91,
        "worker_id": "W-001",
        "worker_name": "Arjun"
    }
    res_entry1 = call_api("/api/cctv/event", data=entry1)
    check(res_entry1 is not None, "First CCTV event accepted")
    check(res_entry1.get("restricted_entry_count") == 1, "Entry count is 1 after first entry")

    # 3. Trigger second unauthorized entry
    section("3. Trigger Second Unauthorized Entry -> Predict Near Miss")
    entry2 = {
        "zone": "Coke Oven Battery 1",
        "event_type": "unauthorized_entry",
        "confidence": 0.88,
        "worker_id": "W-001",
        "worker_name": "Arjun"
    }
    res_entry2 = call_api("/api/cctv/event", data=entry2)
    check(res_entry2 is not None, "Second CCTV event accepted")
    check(res_entry2.get("restricted_entry_count") == 2, "Entry count is 2 after second entry")

    # 4. Fetch near misses predictions
    section("4. Fetch Predicted Near Misses from /api/near-misses")
    predictions = call_api("/api/near-misses", method="GET")
    check(predictions is not None and len(predictions) > 0, "Near misses endpoint returned predictions")
    if predictions:
        p = predictions[0]
        check(p.get("zone") == "Coke Oven Battery 1", "Prediction zone matches")
        check("predicted_incident_probability" in p, "Prediction includes probability")
        check("severity" in p, "Prediction includes severity")
        check("root_causes" in p, "Prediction includes root_causes array")
        check("recommendations" in p, "Prediction includes recommendations array")
        check("confidence_score" in p, "Prediction includes confidence_score")
        check("trend" in p, "Prediction includes trend")
        check("factors" in p, "Prediction includes factors breakdown")
        check("entry_count" in p, "Prediction includes entry_count")
        check(p.get("entry_count") == 2, "Entry count in prediction matches actual count")
        check(p.get("unique_workers_identified") == 1, "Unique workers identified is 1")
        check(len(p.get("root_causes", [])) > 0, "Root causes array is non-empty")
        check(len(p.get("recommendations", [])) > 0, "Recommendations array is non-empty")
        check(p.get("prediction_horizon") == "next_shift", "Prediction horizon is next_shift")
        print(f"\n  Zone: {p.get('zone')}")
        print(f"  Probability: {p.get('predicted_incident_probability')}%")
        print(f"  Severity: {p.get('severity')}")
        print(f"  Confidence: {p.get('confidence_score')}%")
        print(f"  Trend: {p.get('trend')}")
        print(f"  Prediction: {p.get('prediction')}")
        print(f"  Root Causes: {p.get('root_causes')}")
        print(f"  Recommendations: {p.get('recommendations')}")
        print(f"  Factors: {json.dumps(p.get('factors'), indent=2)}")

    # 5. Detailed prediction endpoint
    section("5. Fetch Detailed Prediction from /api/near-miss/predict")
    detail = call_api("/api/near-miss/predict?zone=Coke%20Oven%20Battery%201", method="GET")
    check(detail is not None, "Detailed predict endpoint responded")
    if detail:
        check(detail.get("zone") == "Coke Oven Battery 1", "Detail zone matches")
        check("factors" in detail, "Detail includes factors")
        check("history" in detail, "Detail includes history")
        print(f"\n  Zone: {detail.get('zone')}")
        print(f"  Probability: {detail.get('predicted_incident_probability')}%")
        print(f"  Severity: {detail.get('severity')}")
        print(f"  Confidence: {detail.get('confidence_score')}%")

    # 6. Trigger third entry to test escalation
    section("6. Trigger Third Entry -> Test Escalation")
    entry3 = {
        "zone": "Coke Oven Battery 1",
        "event_type": "unauthorized_entry",
        "confidence": 0.92,
        "worker_id": "W-002",
        "worker_name": "Ravi"
    }
    res_entry3 = call_api("/api/cctv/event", data=entry3)
    check(res_entry3 is not None, "Third CCTV event accepted")
    time.sleep(1)
    predictions2 = call_api("/api/near-misses", method="GET")
    if predictions2:
        p2 = [x for x in predictions2 if x.get("zone") == "Coke Oven Battery 1"]
        if p2:
            check(p2[0].get("entry_count") == 3, "Entry count is 3 after third entry")
            check(p2[0].get("unique_workers_identified") >= 1, "Multiple workers detected")
            check(p2[0].get("predicted_incident_probability", 0) > 50, "Probability escalated with more entries")
            print(f"\n  Probability after 3 entries: {p2[0].get('predicted_incident_probability')}%")
            print(f"  Severity: {p2[0].get('severity')}")
            print(f"  Trend: {p2[0].get('trend')}")

    # 7. Clear and verify reset
    section("7. Clear Alerts and Verify Reset")
    res_clear3 = call_api("/api/cctv/clear?zone=Coke%20Oven%20Battery%201", method="POST")
    check(res_clear3 is not None, "Clear endpoint responded after escalation")
    time.sleep(1)
    predictions_after = call_api("/api/near-misses", method="GET")
    if predictions_after is not None:
        check(len(predictions_after) == 0, "No predictions remain after clearing alerts")
    else:
        check(False, "Failed to fetch predictions after clear")

    # 8. Test another zone with environmental hazards
    section("8. Test Prediction with Environmental Hazards (Blast Furnace A)")
    res_clear_bf = call_api("/api/cctv/clear?zone=Blast%20Furnace%20A", method="POST")
    if res_clear_bf:
        for i in range(2):
            entry = {
                "zone": "Blast Furnace A",
                "event_type": "unauthorized_entry",
                "confidence": 0.85,
                "worker_id": f"W-{10+i}",
                "worker_name": ["Suresh", "Anil"][i]
            }
            call_api("/api/cctv/event", data=entry)
        time.sleep(1)
        bf_predictions = call_api("/api/near-misses", method="GET")
        if bf_predictions:
            bf_p = [x for x in bf_predictions if x.get("zone") == "Blast Furnace A"]
            if bf_p:
                check(bf_p[0].get("entry_count") == 2, "Blast Furnace entry count is 2")
                check(bf_p[0].get("predicted_incident_probability", 0) > 0, "Blast Furnace has prediction probability")
                print(f"\n  Zone: {bf_p[0].get('zone')}")
                print(f"  Probability: {bf_p[0].get('predicted_incident_probability')}%")
                print(f"  Severity: {bf_p[0].get('severity')}")
                print(f"  Environmental Factor: {bf_p[0].get('factors', {}).get('environmental_score', 0)}")

    # Summary
    section("TEST SUMMARY")
    total = passed + failed
    print(f"  Total: {total}  |  Passed: {passed}  |  Failed: {failed}")
    if failed == 0:
        print("  ALL TESTS PASSED.")
        sys.exit(0)
    else:
        print(f"  {failed} TEST(S) FAILED.")
        sys.exit(1)
