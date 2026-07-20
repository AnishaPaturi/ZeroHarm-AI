"""
Test file for Person D (Digital Permit Intelligence Agent + Integration & Deliverables).

Run this AFTER starting the unified server (`python run.py`), from another terminal:
    python test_api_d.py

No frontend needed - this hits Part D's REST endpoints directly, drives the plant
simulation into a compound hazard (hot work permit + rising methane), and proves
Person D's agent independently flags the same permit Person A's rules engine flags,
then proves the /api/integration/full-assessment endpoint returns one unified
payload combining Person A, B, C and D's outputs.
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
    try:
        r = requests.get(f"{BASE_URL}/api/health")
        check("Health status reachable", r.status_code == 200)
    except requests.exceptions.ConnectionError:
        print("\nERROR: Could not connect to the server at http://127.0.0.1:8000")
        print("Make sure your server is running by executing: python run.py")
        exit(1)


def test_baseline_permit_audit():
    section("2. Baseline permit audit — Coke Oven Battery 1 (should be clean)")
    # Reset/ensure Coke Oven Battery 1 is in a clean baseline state first
    requests.post(f"{BASE_URL}/api/state/update?zone_name=Coke%20Oven%20Battery%201", json={
        "gas_readings": {"o2": 20.8, "co": 2.5, "ch4_lfl": 0.1, "h2s": 0.2, "temperature": 29.5, "pressure": 1.01},
        "permits": [{"permit_id": "PTW-2026-001", "permit_type": "hot_work", "status": "active", "zone": "Coke Oven Battery 1", "workers_count": 3}],
        "maintenance_active": False,
        "shift_changeover_active": False
    })
    r = requests.post(f"{BASE_URL}/api/permits/audit", json={"zone": "Coke Oven Battery 1"})
    data = r.json()
    check("Audit endpoint success", r.status_code == 200)
    print(f"  permits_checked={data.get('permits_checked')}  conflicts={len(data.get('conflicts', []))}  "
          f"permit_risk_score={data.get('permit_risk_score')}")


def test_audit_all_zones():
    section("3. Audit all zones in one call")
    r = requests.get(f"{BASE_URL}/api/permits/audit/all")
    data = r.json()
    check("Audit-all endpoint success", r.status_code == 200)
    check("Zones audited == 4", data.get("zones_audited") == 4)
    print(f"  total_conflicts={data.get('total_conflicts')}")


def test_compound_hazard_escalation():
    section("4. Drive methane up under an active Hot Work permit, then re-check")
    # Force Coke Oven Battery 1 to have high methane (>4% LFL) under the active Hot Work permit
    requests.post(f"{BASE_URL}/api/state/update?zone_name=Coke%20Oven%20Battery%201", json={
        "gas_readings": {"o2": 20.8, "co": 2.5, "ch4_lfl": 6.5, "h2s": 0.2, "temperature": 29.5, "pressure": 1.01},
        "permits": [{"permit_id": "PTW-2026-001", "permit_type": "hot_work", "status": "active", "zone": "Coke Oven Battery 1", "workers_count": 3}],
        "maintenance_active": False,
        "shift_changeover_active": False
    })

    r = requests.post(f"{BASE_URL}/api/permits/audit", json={"zone": "Coke Oven Battery 1"})
    data = r.json()
    conflicts = data.get("conflicts", [])
    check("Conflict detected once CH4 exceeds 4% LFL under Hot Work permit", len(conflicts) > 0)
    if conflicts:
        print(f"  First conflict: [{conflicts[0]['conflict_type']}] {conflicts[0]['details']}")
    check("PTW-2026-001 recommended for suspension", "PTW-2026-001" in data.get("suspend_permits", []))


def test_permit_conflicts_dashboard():
    section("5. Plant-wide flagged conflicts (dashboard feed)")
    r = requests.get(f"{BASE_URL}/api/permits/conflicts")
    conflicts = r.json()
    check("Conflicts endpoint success", r.status_code == 200)
    print(f"  {len(conflicts)} active conflict(s) plant-wide, sorted by severity.")
    for c in conflicts[:3]:
        print(f"   - [{c['severity_score']}] {c['zone']} / {c['permit_id']}: {c['conflict_type']}")


def test_full_assessment():
    section("6. Full integration assessment — one call, all four agents")
    r = requests.post(f"{BASE_URL}/api/integration/full-assessment", json={"zone": "Coke Oven Battery 1"})
    data = r.json()
    check("Full assessment endpoint success", r.status_code == 200)
    check("Contains Person A risk_assessment", "composite_risk_score" in data.get("risk_assessment", {}))
    check("Contains Person D permit_audit", "conflicts" in data.get("permit_audit", {}))
    check("Contains Person B heatmap_zone", data.get("heatmap_zone") is not None)
    check("Contains Person C compliance_narrative", len(data.get("compliance_narrative", "")) > 0)
    print(f"\n  unified_risk_score = {data.get('unified_risk_score')}")
    print(f"  unified_action     = {data.get('unified_action')}")
    print(f"  all_flagged_permits = {data.get('all_flagged_permits')}")
    check("Contains collaborative_debate", data.get("collaborative_debate") is not None)
    if data.get("collaborative_debate"):
        print(f"  Collaborative risk probability: {data['collaborative_debate'].get('risk_probability')}%")


def test_collaborative_debate():
    section("6.5. Collaborative Reasoning Multi-Agent Debate")
    r = requests.post(f"{BASE_URL}/api/collaborative-reasoning/debate", json={"zone": "Coke Oven Battery 1"})
    data = r.json()
    check("Collaborative debate endpoint success", r.status_code == 200)
    check("Contains risk_probability", "risk_probability" in data)
    check("Contains prediction", len(data.get("prediction", "")) > 0)
    check("Contains debate_transcript", len(data.get("debate_transcript", [])) > 0)
    print(f"  Risk Probability = {data.get('risk_probability')}%")
    print(f"  Prediction       = {data.get('prediction')}")
    print(f"  First statement  = [{data['debate_transcript'][0]['agent_name']}]: {data['debate_transcript'][0]['message']}")


def test_demo_scenario():
    section("7. Demo scenario script (for demo video / pitch deck)")
    r = requests.get(f"{BASE_URL}/api/integration/demo-scenario")
    data = r.json()
    check("Demo scenario endpoint success", r.status_code == 200)
    check("8-step walkthrough present", len(data.get("steps", [])) == 8)
    print(f"\n  {data.get('title')}")
    for step in data.get("steps", []):
        print(f"   {step['step']}. [{step['agent']}] {step['title']}")


if __name__ == "__main__":
    test_health()
    test_baseline_permit_audit()
    test_audit_all_zones()
    test_compound_hazard_escalation()
    test_permit_conflicts_dashboard()
    test_full_assessment()
    test_collaborative_debate()
    test_demo_scenario()
    section("Person D test suite complete.")
