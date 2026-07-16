from datetime import datetime, timezone
from typing import Dict, Optional

from .models import HeatmapZone, HeatmapSnapshot
from .plant_layout import get_layout

RISK_COLORS = {
    "Safe": "#2e7d32",       # green
    "Warning": "#f9a825",    # amber
    "Critical": "#c62828",   # red
    "Unknown": "#9e9e9e",    # grey - no data yet
}


class HeatmapEngine:
    """
    Holds the current risk snapshot for every plant zone. Fed directly (in-process)
    every time Person A's risk engine produces a new RiskCheckResponse.
    """

    def __init__(self):
        self._layout = get_layout()
        self._zones: Dict[str, HeatmapZone] = {
            zone: HeatmapZone(
                zone=zone,
                polygon=layout.polygon,
                centroid=layout.centroid,
                hazard_classification=layout.hazard_classification,
            )
            for zone, layout in self._layout.items()
        }

    def update_from_risk_assessment(self, zone: str, risk_assessment: dict) -> HeatmapZone:
        """Called whenever a fresh risk_assessment (Person A's RiskCheckResponse shape) arrives."""
        if zone not in self._zones:
            # Unknown zone reported by the engine - add a fallback entry with no geometry
            self._zones[zone] = HeatmapZone(zone=zone, polygon=[], centroid=(0, 0), hazard_classification="Unclassified")

        z = self._zones[zone]
        z.risk_score = risk_assessment.get("composite_risk_score", z.risk_score)
        z.risk_level = risk_assessment.get("risk_level", z.risk_level)
        z.color = RISK_COLORS.get(z.risk_level, RISK_COLORS["Unknown"])
        z.suspend_permits = risk_assessment.get("suspend_permits", [])
        z.action_required = risk_assessment.get("action_required")
        z.last_updated = datetime.now(timezone.utc).isoformat()
        return z

    def update_worker_count(self, zone: str, worker_count: int):
        if zone in self._zones:
            self._zones[zone].worker_count = worker_count

    def get_zone(self, zone: str) -> Optional[HeatmapZone]:
        return self._zones.get(zone)

    def snapshot(self) -> HeatmapSnapshot:
        return HeatmapSnapshot(
            generated_at=datetime.now(timezone.utc).isoformat(),
            zones=list(self._zones.values()),
        )
