from locust import HttpUser, task, between
import random

class ZeroHarmSafetyUser(HttpUser):
    """
    Simulates high-frequency concurrent traffic from SCADA gas sensors,
    live active dashboard client browsers, and automated drone telemetry requests.
    """
    wait_time = between(0.2, 1.5)  # Simulate aggressive high-frequency ticks

    @task(5)
    def post_telemetry_tick(self):
        """Simulates high-frequency gas readings sent by IoT sensors to the risk engine."""
        zones = ["Blast Furnace A", "Coke Oven Battery 1", "Sinter Plant", "Power Plant Substation"]
        zone = random.choice(zones)
        
        # Randomize SCADA gas reading variations
        payload = {
            "zone": zone,
            "gas_readings": {
                "o2": round(random.uniform(19.0, 22.0), 2),
                "co": round(random.uniform(0.0, 30.0), 2),
                "ch4_lfl": round(random.uniform(0.0, 4.0), 2),
                "h2s": round(random.uniform(0.0, 2.0), 2),
                "temperature": round(random.uniform(25.0, 40.0), 1),
                "pressure": round(random.uniform(0.9, 1.3), 2)
            },
            "permits": [],
            "maintenance_active": random.choice([True, False, False, False]),
            "shift_changeover_active": False,
            "timestamp": "2026-07-21T15:00:00Z"
        }
        self.client.post("/risk-score", json=payload)

    @task(3)
    def fetch_live_heatmap(self):
        """Simulates frontend browsers polling the 2D geospatial layout state."""
        self.client.get("/api/state")

    @task(1)
    def check_permit_auditor(self):
        """Simulates shift managers verifying compliance audits across all work permits."""
        self.client.get("/api/permits/audit/all")

    @task(1)
    def fetch_topology_cascades(self):
        """Simulates checking cascading risk propagation across the plant topology graph."""
        self.client.get("/api/topology/cascades")

    @task(1)
    def get_near_miss_predictions(self):
        """Simulates background queries to the predictive near-miss machine learning engine."""
        self.client.get("/api/near-misses")
