import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from .models import PermitAuditResponse, PermitConflict
from .rules import check_zone_permits, check_proximity_conflicts
from ..geospatial.plant_layout import get_layout

logger = logging.getLogger("zeroharm_ai.permits.agent")


class DigitalPermitIntelligenceAgent:
    """
    Person D: analyses active permits against real-time plant conditions,
    both within a zone and against neighbouring zones, and flags dangerous
    simultaneous operations (e.g. hot work near an elevated-gas zone).

    Deliberately stateless/read-only with respect to plant_state — it is
    handed a snapshot each time it's asked to audit, the same pattern Person
    A's `/risk-score` endpoint uses. This keeps it trivial to wire into the
    integration pipeline without introducing shared mutable state bugs.
    """

    def __init__(self):
        self._layout = get_layout()

    def audit_zone(
        self,
        zone: str,
        zone_state: Dict[str, Any],
        all_zone_states: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> PermitAuditResponse:
        permits = zone_state.get("permits", [])
        gas_readings = zone_state.get("gas_readings", {})
        maintenance_active = zone_state.get("maintenance_active", False)
        shift_changeover_active = zone_state.get("shift_changeover_active", False)

        conflicts, clean, suspend = check_zone_permits(
            zone=zone,
            gas_readings=gas_readings,
            permits=permits,
            maintenance_active=maintenance_active,
            shift_changeover_active=shift_changeover_active,
        )

        if all_zone_states:
            proximity_conflicts = check_proximity_conflicts(
                zone=zone, permits=permits, all_zone_states=all_zone_states, zone_layout=self._layout
            )
            conflicts.extend(proximity_conflicts)
            for c in proximity_conflicts:
                if c.permit_id not in suspend:
                    suspend.append(c.permit_id)
                if c.permit_id in clean:
                    clean.remove(c.permit_id)

        permit_risk_score = round(max((c.severity_score for c in conflicts), default=0.0), 1)

        active_count = len([p for p in permits if p.get("status", "").lower() == "active"])

        return PermitAuditResponse(
            zone=zone,
            permits_checked=active_count,
            conflicts=conflicts,
            clean_permits=clean,
            permit_risk_score=permit_risk_score,
            suspend_permits=list(dict.fromkeys(suspend)),
            timestamp=datetime.now().isoformat(),
        )

    def audit_all_zones(self, plant_state: Dict[str, Dict[str, Any]]) -> List[PermitAuditResponse]:
        return [
            self.audit_zone(zone, zone_state, all_zone_states=plant_state)
            for zone, zone_state in plant_state.items()
        ]

    def all_active_conflicts(self, plant_state: Dict[str, Dict[str, Any]]) -> List[PermitConflict]:
        conflicts: List[PermitConflict] = []
        for audit in self.audit_all_zones(plant_state):
            conflicts.extend(audit.conflicts)
        return sorted(conflicts, key=lambda c: c.severity_score, reverse=True)
