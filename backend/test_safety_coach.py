"""
Test client for AI Safety Coach (Innovation 6).

This script tests:
   1. GET /api/safety-coach/workers - list all worker profiles
   2. GET /api/safety-coach/worker/{worker_id} - individual profile detail
   3. POST /api/safety-coach/event - ingest behavioral events (ppe_violation, zone_violation, etc.)
   4. GET /api/safety-coach/leaderboard - most at risk / safest workers
   5. Verify safety score calculations and recommendations update correctly
   6. Verify CCTV events automatically feed into safety coach

Make sure the FastAPI server is running on http://127.0.0.1:8000 before running:
    python backend/test_safety_coach.py
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

    print("ZeroHarm AI - AI Safety Coach Test Client")
    print("Connecting to http://127.0.0.1:8000 ...")

    # 1. Get all worker profiles
    section("1. Fetch all worker safety profiles")
    all_profiles = call_api("/api/safety-coach/workers", method="GET")
    check(all_profiles is not None and isinstance(all_profiles, list), "Profiles endpoint returned a list")
    if all_profiles:
        check(len(all_profiles) > 0, f"Found {len(all_profiles)} worker profiles")
        p0 = all_profiles[0]
        check("worker_id" in p0, "Profile includes worker_id")
        check("name" in p0, "Profile includes name")
        check("safety_score" in p0, "Profile includes safety_score")
        check("ppe_violations" in p0, "Profile includes ppe_violations")
        check("zone_violations" in p0, "Profile includes zone_violations")
        check("ignored_alerts" in p0, "Profile includes ignored_alerts")
        check("fatigue_score" in p0, "Profile includes fatigue_score")
        check("risk_exposure_score" in p0, "Profile includes risk_exposure_score")
        check("recommendations" in p0, "Profile includes recommendations")
        check("trend" in p0, "Profile includes trend")
        print(f"\n  Sample worker: {p0.get('name')} ({p0.get('worker_id')})")
        print(f"  Safety Score: {p0.get('safety_score')}")
        print(f"  Zone: {p0.get('zone')}")
        print(f"  Trend: {p0.get('trend')}")

    # 2. Get individual worker profile
    section("2. Fetch individual worker profile")
    test_worker_id = None
    if all_profiles:
        test_worker_id = all_profiles[0]["worker_id"]
        individual = call_api(f"/api/safety-coach/worker/{test_worker_id}", method="GET")
        check(individual is not None, "Individual profile endpoint responded")
        check(individual.get("worker_id") == test_worker_id, "Individual profile worker_id matches")
        check("event_history" in individual, "Individual profile includes event_history")
    else:
        check(False, "No profiles available to test individual endpoint")

    # 3. Ingest PPE violation event
    section("3. Ingest PPE violation event")
    import uuid
    test_worker = f"W-TEST-{uuid.uuid4().hex[:6]}"
    ppe_event = {
        "worker_id": test_worker,
        "event_type": "ppe_violation",
        "worker_name": "Test Worker",
        "zone": "Coke Oven Battery 1"
    }
    res_ppe = call_api("/api/safety-coach/event", data=ppe_event)
    check(res_ppe is not None, "PPE event ingested successfully")
    if res_ppe:
        check(res_ppe.get("worker_id") == test_worker, "Response worker_id matches")
        check(res_ppe.get("event_type") == "ppe_violation", "Response event_type matches")
        check(res_ppe.get("new_safety_score") is not None, "Response includes new_safety_score")
        print(f"\n  Worker: {res_ppe.get('worker_id')}")
        print(f"  New Safety Score: {res_ppe.get('new_safety_score')}")
        print(f"  Trend: {res_ppe.get('trend')}")

    # 4. Ingest zone violation event
    section("4. Ingest zone violation event")
    zone_event = {
        "worker_id": test_worker,
        "event_type": "zone_violation",
        "worker_name": "Test Worker",
        "zone": "Coke Oven Battery 1"
    }
    res_zone = call_api("/api/safety-coach/event", data=zone_event)
    check(res_zone is not None, "Zone violation event ingested")
    if res_zone:
        check(res_zone.get("new_safety_score") is not None, "Score updated after zone violation")
        print(f"\n  New Safety Score after zone violation: {res_zone.get('new_safety_score')}")

    # 5. Ingest alert ignored event
    section("5. Ingest alert ignored event")
    alert_event = {
        "worker_id": test_worker,
        "event_type": "alert_ignored",
        "worker_name": "Test Worker",
        "zone": "Coke Oven Battery 1"
    }
    res_alert = call_api("/api/safety-coach/event", data=alert_event)
    check(res_alert is not None, "Alert ignored event ingested")

    # 6. Ingest hazard exposure event
    section("6. Ingest hazard exposure event")
    hazard_event = {
        "worker_id": test_worker,
        "event_type": "hazard_exposure",
        "worker_name": "Test Worker",
        "zone": "Blast Furnace A"
    }
    res_hazard = call_api("/api/safety-coach/event", data=hazard_event)
    check(res_hazard is not None, "Hazard exposure event ingested")
    if res_hazard:
        check(res_hazard.get("trend") == "escalating", "Trend is escalating after multiple violations")
        print(f"\n  Trend: {res_hazard.get('trend')}")

    # 7. Verify profile updated
    section("7. Verify profile reflects accumulated events")
    updated_profile = call_api(f"/api/safety-coach/worker/{test_worker}", method="GET")
    check(updated_profile is not None, "Updated profile retrieved")
    if updated_profile:
        check(updated_profile.get("ppe_violations", 0) >= 1, f"PPE violations >= 1 (got {updated_profile.get('ppe_violations')})")
        check(updated_profile.get("zone_violations", 0) >= 1, f"Zone violations >= 1 (got {updated_profile.get('zone_violations')})")
        check(updated_profile.get("ignored_alerts", 0) >= 1, f"Ignored alerts >= 1 (got {updated_profile.get('ignored_alerts')})")
        check(len(updated_profile.get("recommendations", [])) > 0, "Recommendations generated")
        check(updated_profile.get("safety_score", 100) < 100, "Safety score decreased")
        print(f"\n  Safety Score: {updated_profile.get('safety_score')}")
        print(f"  PPE Violations: {updated_profile.get('ppe_violations')}")
        print(f"  Zone Violations: {updated_profile.get('zone_violations')}")
        print(f"  Ignored Alerts: {updated_profile.get('ignored_alerts')}")
        print(f"  Recommendations: {updated_profile.get('recommendations')[:3]}")

    # 8. Test leaderboard
    section("8. Test leaderboard endpoint")
    leaderboard = call_api("/api/safety-coach/leaderboard?limit=5", method="GET")
    check(leaderboard is not None, "Leaderboard endpoint responded")
    if leaderboard:
        check("most_at_risk" in leaderboard, "Leaderboard includes most_at_risk")
        check("safest" in leaderboard, "Leaderboard includes safest")
        print(f"\n  Most at risk count: {len(leaderboard.get('most_at_risk', []))}")
        print(f"  Safest count: {len(leaderboard.get('safest', []))}")

    # 9. Test CCTV auto-ingestion (PPE)
    section("9. Test CCTV auto-ingestion for PPE violation")
    cctv_ppe_worker = f"W-AUTO-{uuid.uuid4().hex[:6]}"
    cctv_ppe = {
        "zone": "Coke Oven Battery 1",
        "event_type": "no_ppe",
        "confidence": 0.92,
        "worker_id": cctv_ppe_worker,
        "worker_name": "Auto PPE Test"
    }
    res_cctv_ppe = call_api("/api/cctv/event", data=cctv_ppe)
    check(res_cctv_ppe is not None, "CCTV PPE event processed")
    if res_cctv_ppe:
        auto_profile = call_api(f"/api/safety-coach/worker/{cctv_ppe_worker}", method="GET")
        check(auto_profile is not None, "Auto profile created from CCTV")
        if auto_profile:
            check(auto_profile.get("ppe_violations", 0) >= 1, "PPE violations incremented via CCTV")
            print(f"\n  Auto Worker: {auto_profile.get('name')}")
            print(f"  PPE Violations: {auto_profile.get('ppe_violations')}")

    # 10. Test CCTV auto-ingestion (zone violation)
    section("10. Test CCTV auto-ingestion for zone violation")
    cctv_zone_worker = f"W-AUTO-{uuid.uuid4().hex[:6]}"
    cctv_zone = {
        "zone": "Blast Furnace A",
        "event_type": "unauthorized_entry",
        "confidence": 0.88,
        "worker_id": cctv_zone_worker,
        "worker_name": "Auto Zone Test"
    }
    res_cctv_zone = call_api("/api/cctv/event", data=cctv_zone)
    check(res_cctv_zone is not None, "CCTV zone event processed")
    if res_cctv_zone:
        auto_zone_profile = call_api(f"/api/safety-coach/worker/{cctv_zone_worker}", method="GET")
        check(auto_zone_profile is not None, "Auto zone profile created from CCTV")
        if auto_zone_profile:
            check(auto_zone_profile.get("zone_violations", 0) >= 1, "Zone violations incremented via CCTV")
            print(f"\n  Auto Worker: {auto_zone_profile.get('name')}")
            print(f"  Zone Violations: {auto_zone_profile.get('zone_violations')}")

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
