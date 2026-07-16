import urllib.request
import json
import time

API_URL = "http://127.0.0.1:8000/risk-score"

def run_test_case(name, data):
    print(f"\n==================================================")
    print(f"RUNNING TEST CASE: {name}")
    print(f"==================================================")
    
    req_body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=req_body,
        headers={"Content-Type": "application/json"}
    )
    
    try:
        start_time = time.time()
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            res_data = json.loads(res_body)
            duration = (time.time() - start_time) * 1000
            
            print(f"Status: Success | Response Time: {duration:.1f}ms")
            print(f"Zone: {res_data.get('zone')}")
            print(f"Composite Risk Score: {res_data.get('composite_risk_score')} (Level: {res_data.get('risk_level')})")
            print(f"Rules Score: {res_data.get('rule_score')} | ML Score: {res_data.get('ml_score')}")
            print(f"Recommended Action: {res_data.get('action_required')}")
            
            suspends = res_data.get('suspend_permits', [])
            if suspends:
                print(f"SUSPEND PERMITS: {suspends}")
                
            print("\nFactors breakdown:")
            for factor in res_data.get('factors', []):
                print(f" - [{factor['name']}] Score: {factor['score']} (Contrib: {factor['contribution']}%) | Details: {factor['details']}")
                
    except urllib.error.URLError as e:
        print(f"Error connecting to server: {e}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    print("ZeroHarm AI Risk Engine API Testing Client")
    print("Make sure your FastAPI server is running on http://127.0.0.1:8000")
    
    # 1. Normal State (no hazards, no permits)
    normal_case = {
        "zone": "Blast Furnace A",
        "gas_readings": {
            "o2": 20.8,
            "co": 2.0,
            "ch4_lfl": 0.0,
            "h2s": 0.1,
            "temperature": 28.0,
            "pressure": 1.0
        },
        "permits": [],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "timestamp": "2026-07-15T16:00:00Z"
    }
    
    # 2. Confined Space Entry - Normal
    confined_space_normal = {
        "zone": "Sinter Plant",
        "gas_readings": {
            "o2": 20.8,
            "co": 2.0,
            "ch4_lfl": 0.0,
            "h2s": 0.0,
            "temperature": 28.0,
            "pressure": 1.0
        },
        "permits": [{
            "permit_id": "PTW-CS-101",
            "permit_type": "confined_space",
            "status": "active",
            "zone": "Sinter Plant",
            "workers_count": 2
        }],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "timestamp": "2026-07-15T16:00:00Z"
    }

    # 3. Methane Leak During Hot Work (Welding)
    hot_work_leak = {
        "zone": "Coke Oven Battery 1",
        "gas_readings": {
            "o2": 20.8,
            "co": 5.0,
            "ch4_lfl": 6.8,  # > 4% safety limit for hot work
            "h2s": 0.1,
            "temperature": 32.5,
            "pressure": 1.02
        },
        "permits": [{
            "permit_id": "PTW-HW-202",
            "permit_type": "hot_work",
            "status": "active",
            "zone": "Coke Oven Battery 1",
            "workers_count": 3
        }],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "timestamp": "2026-07-15T16:00:00Z"
    }

    # 4. Asphyxiation Hazard in Confined Space
    confined_space_hazard = {
        "zone": "Sinter Plant",
        "gas_readings": {
            "o2": 16.2,  # Critically low oxygen (< 19.5%)
            "co": 28.0,  # Toxic CO spike
            "ch4_lfl": 0.1,
            "h2s": 0.2,
            "temperature": 29.0,
            "pressure": 0.98
        },
        "permits": [{
            "permit_id": "PTW-CS-101",
            "permit_type": "confined_space",
            "status": "active",
            "zone": "Sinter Plant",
            "workers_count": 2
        }],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "timestamp": "2026-07-15T16:00:00Z"
    }

    # 5. SIMOPs Conflict (Hot Work + Confined Space active in same zone)
    simops_conflict = {
        "zone": "Coke Oven Battery 1",
        "gas_readings": {
            "o2": 20.8,
            "co": 3.0,
            "ch4_lfl": 0.2,
            "h2s": 0.1,
            "temperature": 30.0,
            "pressure": 1.0
        },
        "permits": [
            {
                "permit_id": "PTW-HW-202",
                "permit_type": "hot_work",
                "status": "active",
                "zone": "Coke Oven Battery 1",
                "workers_count": 3
            },
            {
                "permit_id": "PTW-CS-303",
                "permit_type": "confined_space",
                "status": "active",
                "zone": "Coke Oven Battery 1",
                "workers_count": 2
            }
        ],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "timestamp": "2026-07-15T16:00:00Z"
    }

    # 6. Shift Changeover during Active Maintenance with Sub-critical Gas
    changeover_maintenance = {
        "zone": "Blast Furnace A",
        "gas_readings": {
            "o2": 20.6,
            "co": 18.0,  # Elevated but not critical
            "ch4_lfl": 3.5,  # Elevated but not critical
            "h2s": 0.8,
            "temperature": 34.0,
            "pressure": 1.25  # High pressure
        },
        "permits": [],
        "maintenance_active": True,
        "shift_changeover_active": True,
        "timestamp": "2026-07-15T16:00:00Z"
    }

    # Run tests
    run_test_case("1. Clean Environment", normal_case)
    time.sleep(0.5)
    run_test_case("2. Confined Space (Normal atmosphere)", confined_space_normal)
    time.sleep(0.5)
    run_test_case("3. Methane Leak during Hot Work", hot_work_leak)
    time.sleep(0.5)
    run_test_case("4. Depleted O2 & toxic CO in Confined Space", confined_space_hazard)
    time.sleep(0.5)
    run_test_case("5. SIMOPs Clash (Hot Work + Confined Space)", simops_conflict)
    time.sleep(0.5)
    run_test_case("6. Shift Handover + Maintenance + Sub-critical Drift (ML Anomaly Catch)", changeover_maintenance)
