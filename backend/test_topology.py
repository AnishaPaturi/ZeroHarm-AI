"""
Test client for Plant Topology and Cascading Risk Engine.

This script tests:
  1. GET /api/topology - Retrieve nodes & edges of process knowledge graph
  2. GET /api/topology/cascades - Retrieve current active risk cascades
  3. POST /api/integration/full-assessment - Verify unified score includes cascades

Make sure the FastAPI server is running on http://127.0.0.1:8000 before running:
    python backend/test_topology.py
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
    print("ZeroHarm AI - Plant Topology Knowledge Graph Test Client")
    print("Connecting to http://127.0.0.1:8000 ...")
    
    # 1. Fetch Topology Graph Structure
    section("1. Process Topology Knowledge Graph Structure")
    topology = call_api("/api/topology", method="GET")
    if not topology:
        print("ERROR: Is the FastAPI server running?")
        exit(1)
        
    print(f"Topology Nodes: {topology['nodes']}")
    print("Topology Process Flow Edges:")
    for edge in topology['edges']:
        print(f" - {edge['source']} ---> {edge['target']} ({edge['connection_type']}) | Factor: {edge['propagation_factor']}")

    # 2. Trigger high risk on Blast Furnace A manually
    section("2. Escalating Risk on Blast Furnace A")
    bf_alert = {
        "zone": "Blast Furnace A",
        "reason": "Simulated structural valve leak in recovery pipe"
    }
    trigger_res = call_api("/api/alerts/trigger", data=bf_alert)
    if trigger_res:
        print(f"Blast Furnace A alarm status: {trigger_res['status']}")

    # Wait a moment for state changes
    time.sleep(0.5)

    # 3. Fetch Cascading Risks
    section("3. Current Active Risk Cascades")
    cascades = call_api("/api/topology/cascades", method="GET")
    if cascades:
        for zone, data in cascades.items():
            print(f"Zone: {zone} | Propagated Cascading Risk Score: {data['propagated_score']}")
            if data['sources']:
                print("   Contributing Upstream Sources:")
                for source in data['sources']:
                    print(f"    - {source['source_zone']}: {source['source_risk']} risk via {source['connection']} (contrib: {source['propagated_risk']})")

    # 4. Fetch Full Assessment for Coke Oven Battery 1 (downstream of Blast Furnace A)
    section("4. Full Assessment for Coke Oven Battery 1 (Verify Unified Score)")
    assessment = call_api("/api/integration/full-assessment", data={"zone": "Coke Oven Battery 1"})
    if assessment:
        print(f"Zone: {assessment['zone']}")
        print(f"Local Composite Risk Score: {assessment['risk_assessment']['composite_risk_score']}")
        print(f"Unified Risk Score (includes Cascade): {assessment['unified_risk_score']}")
        print(f"Unified Action Recommendation:")
        print(f"  {assessment['unified_action']}")
        print(f"Topology Cascade Metadata: {assessment['topology_cascade']}")
