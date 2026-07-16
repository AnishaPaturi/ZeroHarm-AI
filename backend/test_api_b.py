"""
Test file for Person B (Geospatial Safety Heatmap + Emergency Response Orchestrator).

Run this AFTER starting the unified server (`python run.py`), from another terminal:
    python test_api_b.py

No frontend needed - this hits Part B's REST endpoints directly and drives the
plant simulation (Person A's /api/simulate/tick) to prove the two halves are
wired together correctly:  gas/permit change -> risk score -> heatmap update
-> (if Critical) evacuation trigger -> simulated alerts -> incident report.
"""

import requests
import time

BASE_URL = "http://127.0.0.1:8000"


def section(title):
    print(f"\n{'=' * 60}\n{title}\n{'=' * 60}")


def check(label, condition):
    print(f"  [{'PASS' if condition else 'FAIL'}] {label}")
    return condition


def test_health():
    section("1. Health check")
    r = requests.get(f"{BASE_URL}/api/health")
    check("server reachable", r.status_code == 200)
    print(" ", r.json())


def test_plant_layout():
    section("2. Plant layout (static geometry)")
    r = requests.get(f"{BASE_URL}/api/plant-layout")
    data = r.json()
    check("status 200", r.status_code == 200)
    check("has all 4 known zones", all(z in data for z in
          ["Coke Oven Battery 1", "Blast Furnace A", "Sinter Plant", "Ammonia Storage Tank"]))
    for zone, layout in data.items():
        print(f"  - {zone}: {layout['hazard_classification']} | centroid={layout['centroid']}")


def test_workers():
    section("3. Worker location overlay")
    r = requests.get(f"{BASE_URL}/api/workers")
    workers = r.json()
    check("status 200", r.status_code == 200)
    check("at least one worker seeded", len(workers) > 0)
    print(f"  {len(workers)} workers total. Sample: {workers[0] if workers else 'none'}")


def test_heatmap_before_any_events():
    section("4. Heatmap snapshot (before driving any risk events)")
    r = requests.get(f"{BASE_URL}/api/heatmap")
    data = r.json()
    check("status 200", r.status_code == 200)
    check("has zones", len(data.get("zones", [])) > 0)
    for z in data["zones"]:
        print(f"  - {z['zone']}: level={z['risk_level']} score={z['risk_score']} color={z['color']}")


def test_manual_alert_trigger():
    section("5. Manual orchestrator trigger (no dependency on Part A's simulation)")
    zone = "Sinter Plant"
    r = requests.post(f"{BASE_URL}/api/alerts/trigger", json={"zone": zone, "reason": "test_part_b.py manual trigger"})
    check("trigger accepted", r.status_code == 200)

    time.sleep(0.3)

    heatmap = requests.get(f"{BASE_URL}/api/heatmap").json()
    zone_entry = next(z for z in heatmap["zones"] if z["zone"] == zone)
    check(f"'{zone}' now shows Critical on heatmap", zone_entry["risk_level"] == "Critical")

    evac = requests.get(f"{BASE_URL}/api/evacuations").json()
    zone_evac = [e for e in evac if e["zone"] == zone]
    check("evacuation record created", len(zone_evac) > 0)
    if zone_evac:
        print(f"  Evacuation record: {zone_evac[-1]}")

    alerts = requests.get(f"{BASE_URL}/api/alerts", params={"zone": zone}).json()
    check("alerts dispatched across channels (sms/email/slack)",
          {"sms", "email", "slack"}.issubset({a["channel"] for a in alerts}))

    incidents = requests.get(f"{BASE_URL}/api/incidents", params={"zone": zone}).json()
    check("preliminary incident report auto-generated", len(incidents) > 0)
    if incidents:
        print(f"  Incident report: {incidents[-1]['report_id']} - {incidents[-1]['narrative'][:120]}...")


def test_full_integration_via_simulation():
    section("6. Full integration: drive Person A's simulation and watch Person B react")
    print("  Ticking the plant simulation until a Critical event fires (cycle 4 or 7 or 10 - up to 12 ticks)...")

    triggered_zone = None
    for i in range(13):
        r = requests.post(f"{BASE_URL}/api/simulate/tick")
        check(f"tick {i+1} succeeded (HTTP {r.status_code})", r.status_code == 200)
        tick_data = r.json()
        for update in tick_data.get("updates", []):
            if update.get("risk_level") == "Critical":
                triggered_zone = update.get("zone")
        if triggered_zone:
            break
        time.sleep(0.2)

    check("a Critical event occurred during simulation", triggered_zone is not None)
    if not triggered_zone:
        return

    print(f"  Critical event occurred in zone: {triggered_zone}")

    heatmap = requests.get(f"{BASE_URL}/api/heatmap").json()
    zone_entry = next(z for z in heatmap["zones"] if z["zone"] == triggered_zone)
    check("heatmap reflects the Critical zone", zone_entry["risk_level"] == "Critical")

    evac = requests.get(f"{BASE_URL}/api/evacuations").json()
    check("evacuation record exists for triggered zone", any(e["zone"] == triggered_zone for e in evac))

    workers = requests.get(f"{BASE_URL}/api/workers", params={"zone": triggered_zone}).json()
    check("worker statuses updated (evacuating/evacuated)",
          any(w["status"] in ("evacuating", "evacuated") for w in workers))

    incidents = requests.get(f"{BASE_URL}/api/incidents", params={"zone": triggered_zone}).json()
    check("incident report generated for this event", len(incidents) > 0)


if __name__ == "__main__":
    print("ZeroHarm AI Part B Test Suite")
    print("Make sure the unified server is running: python run.py")
    try:
        test_health()
        test_plant_layout()
        test_workers()
        test_heatmap_before_any_events()
        test_manual_alert_trigger()
        test_full_integration_via_simulation()
        print("\nDone.")
    except requests.exceptions.ConnectionError:
        print("\nERROR: Could not connect to the server at http://127.0.0.1:8000")
        print("Start it first with: python run.py")
