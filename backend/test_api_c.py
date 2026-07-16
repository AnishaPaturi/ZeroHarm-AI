"""
Test client for Person C (Incident Pattern Intelligence + Compliance Audit Agent RAG).

Run this AFTER starting the unified server (`python run.py`), from another terminal:
    python backend/test_api_c.py
"""

import requests
import json
import time
import sys
import io

# Force UTF-8 encoding for console output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def section(title):
    print(f"\n{'=' * 60}\n{title}\n{'=' * 60}")

def check(label, condition):
    print(f"  [{'PASS' if condition else 'FAIL'}] {label}")
    return condition

def test_health():
    section("1. Health Check & RAG Mode")
    try:
        r = requests.get(f"{BASE_URL}/api/health")
        data = r.json()
        check("Health status reachable", r.status_code == 200)
        print("  Status:", data)
        check("RAG mode initialized", "rag_mode" in data)
    except requests.exceptions.ConnectionError:
        print("\nERROR: Could not connect to the server at http://127.0.0.1:8000")
        print("Make sure your server is running by executing: python backend/run.py")
        exit(1)

def test_documents():
    section("2. Fetch Indexed RAG Documents")
    r = requests.get(f"{BASE_URL}/api/rag/documents")
    docs = r.json()
    check("Documents endpoint success", r.status_code == 200)
    check("Documents returned", len(docs) > 0)
    print(f"  Successfully retrieved {len(docs)} indexed RAG documents:")
    for doc in docs:
        print(f"   - [{doc['id']}] {doc['title']} (Source: {doc['source']})")

def test_rag_query():
    section("3. RAG Query: Historical Precedents Lookup")
    # Query about past CO leaks during handover
    query_data = {"query": "Have we seen a Carbon Monoxide leak during shift changeover before?"}
    r = requests.post(f"{BASE_URL}/api/rag/query", json=query_data)
    res = r.json()
    
    check("Query endpoint success", r.status_code == 200)
    print(f"  Mode: {res.get('mode')}")
    print("\n  Answer:")
    print(res.get("answer"))
    
    print("\n  Retrieved Sources:")
    for src in res.get("sources", []):
        print(f"   - {src['title']} (Score: {src['score']})")

def test_compliance_audit_confined():
    section("4. Compliance Audit: Confined Space Low Oxygen")
    # Sinter Plant with 16.5% O2 (Deficient) during Confined Space entry
    audit_data = {
        "zone": "Sinter Plant",
        "telemetry": {
            "o2": 16.5,
            "co": 35.0,
            "ch4_lfl": 0.1,
            "h2s": 0.2
        },
        "permits": [
            {
                "permit_id": "PTW-CS-101",
                "permit_type": "confined_space",
                "status": "active",
                "zone": "Sinter Plant"
            }
        ],
        "maintenance_active": True,
        "shift_changeover_active": False
    }
    r = requests.post(f"{BASE_URL}/api/compliance/audit", json=audit_data)
    res = r.json()
    
    check("Audit endpoint success", r.status_code == 200)
    print("\n  Compliance Audit Answer:")
    print(res.get("answer"))

def test_compliance_audit_hotwork():
    section("5. Compliance Audit: Hot Work Spark Hazard")
    # Coke Oven Battery 1 with 6.5% LFL Methane during welding (Hot work limit is < 4%)
    audit_data = {
        "zone": "Coke Oven Battery 1",
        "telemetry": {
            "o2": 20.8,
            "co": 5.0,
            "ch4_lfl": 6.5,
            "h2s": 0.1
        },
        "permits": [
            {
                "permit_id": "PTW-HW-202",
                "permit_type": "hot_work",
                "status": "active",
                "zone": "Coke Oven Battery 1"
            }
        ],
        "maintenance_active": False,
        "shift_changeover_active": False
    }
    r = requests.post(f"{BASE_URL}/api/compliance/audit", json=audit_data)
    res = r.json()
    
    check("Audit endpoint success", r.status_code == 200)
    print("\n  Compliance Audit Answer:")
    print(res.get("answer"))

if __name__ == "__main__":
    print("ZeroHarm AI - Person C Compliance RAG Test Client")
    print("Connecting to http://127.0.0.1:8000 ...")
    test_health()
    test_documents()
    test_rag_query()
    test_compliance_audit_confined()
    test_compliance_audit_hotwork()
    print("\nDone.")
