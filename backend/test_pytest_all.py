import pytest
from fastapi.testclient import TestClient
from jsonschema import validate, RefResolver
from backend.app.main import app

# Initialize the TestClient in-process
client = TestClient(app)

@pytest.fixture(scope="module")
def openapi_spec():
    """Retrieve and cache the live OpenAPI specification from the application."""
    response = client.get("/openapi.json")
    assert response.status_code == 200, "Failed to retrieve OpenAPI schema"
    return response.json()


def validate_contract(data: dict, schema_name: str, spec: dict):
    """Utility function to validate a response dictionary against the OpenAPI schema spec."""
    components = spec.get("components", {})
    schema = components.get("schemas", {}).get(schema_name)
    assert schema is not None, f"Schema {schema_name} not found in OpenAPI specification"
    
    # Resolve local references (e.g. #/components/schemas/FactorRisk)
    resolver = RefResolver.from_schema(spec)
    validate(instance=data, schema=schema, resolver=resolver)


# ==============================================================================
# 1. API Contract & Risk Score Tests (Person A Scenarios)
# ==============================================================================

def test_api_contract_and_clean_environment(openapi_spec):
    payload = {
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
        "timestamp": "2026-07-21T15:00:00Z"
    }
    
    response = client.post("/risk-score", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    # Verify contract
    validate_contract(data, "RiskCheckResponse", openapi_spec)
    
    # Verify logic
    assert data["zone"] == "Blast Furnace A"
    assert data["risk_level"] == "Safe"
    assert data["composite_risk_score"] == 3.0


def test_confined_space_normal_atmosphere(openapi_spec):
    payload = {
        "zone": "Sinter Plant",
        "gas_readings": {
            "o2": 20.8,
            "co": 2.0,
            "ch4_lfl": 0.0,
            "h2s": 0.1,
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
        "timestamp": "2026-07-21T15:00:00Z"
    }
    
    response = client.post("/risk-score", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    validate_contract(data, "RiskCheckResponse", openapi_spec)
    assert data["risk_level"] == "Safe"
    assert data["composite_risk_score"] == 18.0


def test_methane_leak_during_hotwork(openapi_spec):
    payload = {
        "zone": "Coke Oven Battery 1",
        "gas_readings": {
            "o2": 20.8,
            "co": 5.0,
            "ch4_lfl": 6.8,
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
        "timestamp": "2026-07-21T15:00:00Z"
    }
    
    response = client.post("/risk-score", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    validate_contract(data, "RiskCheckResponse", openapi_spec)
    assert data["risk_level"] == "Critical"
    assert data["composite_risk_score"] == 95.0
    assert "PTW-HW-202" in data["suspend_permits"]


def test_simops_clash(openapi_spec):
    payload = {
        "zone": "Coke Oven Battery 1",
        "gas_readings": {
            "o2": 20.8,
            "co": 2.0,
            "ch4_lfl": 0.0,
            "h2s": 0.1,
            "temperature": 28.0,
            "pressure": 1.0
        },
        "permits": [
            {
                "permit_id": "PTW-CS-101",
                "permit_type": "confined_space",
                "status": "active",
                "zone": "Coke Oven Battery 1",
                "workers_count": 2
            },
            {
                "permit_id": "PTW-HW-202",
                "permit_type": "hot_work",
                "status": "active",
                "zone": "Coke Oven Battery 1",
                "workers_count": 3
            }
        ],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "timestamp": "2026-07-21T15:00:00Z"
    }
    
    response = client.post("/risk-score", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    validate_contract(data, "RiskCheckResponse", openapi_spec)
    assert data["risk_level"] == "Critical"
    assert data["composite_risk_score"] == 80.0
    # Checks for SIMOPs conflict presence
    has_simops = any("SIMOPs" in f["name"] for f in data["factors"])
    assert has_simops


# ==============================================================================
# 2. Temporal Drift & Accumulation Tests
# ==============================================================================

def test_temporal_co_accumulation():
    # Reset zone state
    client.post("/api/state/update?zone_name=Coke%20Oven%20Battery%201", json={
        "gas_readings": {"o2": 20.8, "co": 0.0, "ch4_lfl": 0.0, "h2s": 0.0, "temperature": 25.0, "pressure": 1.0},
        "permits": [],
        "maintenance_active": False,
        "shift_changeover_active": False,
        "timestamp": "2026-07-21T15:00:00Z"
    })
    
    # Send subsequent ticks with increasing CO to calculate drift
    payloads = [
        {"o2": 20.8, "co": 5.0, "ch4_lfl": 0.0, "h2s": 0.0, "temperature": 25.0, "pressure": 1.0},
        {"o2": 20.8, "co": 15.0, "ch4_lfl": 0.0, "h2s": 0.0, "temperature": 25.0, "pressure": 1.0},
        {"o2": 20.8, "co": 28.0, "ch4_lfl": 0.0, "h2s": 0.0, "temperature": 25.0, "pressure": 1.0}
    ]
    
    for p in payloads:
        response = client.post("/risk-score", json={
            "zone": "Coke Oven Battery 1",
            "gas_readings": p,
            "permits": [],
            "maintenance_active": False,
            "shift_changeover_active": False,
            "timestamp": "2026-07-21T15:00:00Z"
        })
        assert response.status_code == 200
    
    # Fetch final details and verify drift is calculated
    final_data = response.json()
    factors = [f["name"] for f in final_data["factors"]]
    # The third tick should trigger toxic CO warning or higher score
    assert "CO Toxicity Risk" in factors or final_data["composite_risk_score"] > 20.0


# ==============================================================================
# 3. Plant Topology Cascading Risk Tests (Person D Integration)
# ==============================================================================

def test_plant_topology_propagation():
    # 1. Fetch current topology status
    response = client.get("/api/topology")
    assert response.status_code == 200
    topology_data = response.json()
    assert "Coke Oven Battery 1" in topology_data["nodes"]
    
    # 2. Trigger high risk on Blast Furnace A (upstream source)
    alert_payload = {
        "zone": "Blast Furnace A",
        "reason": "Simulated structural valve leak in recovery pipe"
    }
    trigger_response = client.post("/api/alerts/trigger", json=alert_payload)
    assert trigger_response.status_code == 200
    
    # 3. Request cascades and check if Coke Oven Battery 1 shows propagated risk
    response = client.get("/api/topology/cascades")
    assert response.status_code == 200
    cascades = response.json()
    
    coke_oven_cascade = cascades.get("Coke Oven Battery 1", {})
    assert coke_oven_cascade.get("propagated_score", 0.0) > 0.0
    sources = coke_oven_cascade.get("sources", [])
    assert any(s["source_zone"] == "Blast Furnace A" for s in sources)
