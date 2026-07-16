"""
Person D — Digital Permit Intelligence Agent.

Cross-checks active work permits against *real-time plant conditions* — both
inside their own zone and in neighbouring zones — and flags dangerous
simultaneous operations before they escalate.

This is deliberately separate from Person A's `engine/rules.py`. Person A
answers "how risky is this zone right now?" (a composite telemetry score).
Person D answers a narrower, permit-specific question: "is this *specific
permit*, as currently authorised, safe to keep running?" — and produces a
permit-issuing-authority-facing recommendation rather than a zone-facing one.
"""
import math
from typing import List, Tuple, Dict, Any, Optional

from .models import PermitConflict

# ---------------------------------------------------------------------------
# Static permit-type knowledge base (stand-in for a digitised OISD/Factories
# Act permit-to-work rulebook). Kept small and explicit for the demo.
# ---------------------------------------------------------------------------
PERMIT_RULES: Dict[str, Dict[str, Any]] = {
    "hot_work": {
        "ignition_source": True,
        "ch4_lfl_limit": 4.0,           # OISD-STD-105
        "regulatory_ref": "OISD-STD-105 (Work Permit System)",
        "required_docs": ["Gas-free certificate", "Fire watch attendant log", "Isolation certificate"],
    },
    "confined_space": {
        "requires_atmosphere_test": True,
        "o2_min": 19.5,
        "co_limit": 15.0,
        "h2s_limit": 3.0,
        "ch4_lfl_limit": 3.0,
        "regulatory_ref": "Factories Act 1948, Section 36",
        "required_docs": ["Atmospheric test log", "Standby rescue watch sign-off", "Entry/exit register"],
    },
    "height_work": {
        "falling_object_hazard": True,
        "regulatory_ref": "OISD-STD-105 (SIMOPs Annexure)",
        "required_docs": ["Harness inspection tag", "Exclusion zone barricading confirmation"],
    },
    "cold_work": {
        "regulatory_ref": "OISD-STD-105 (General Work Permit)",
        "required_docs": ["Toolbox talk sign-off"],
    },
}

# Proximity threshold (plant-coordinate units, same units as geospatial polygons)
# below which a hazard in one zone is considered close enough to threaten a
# permit operating in an adjacent zone.
PROXIMITY_THRESHOLD = 60.0


def _gas_get(gas: Dict[str, Any], key: str, default: float = 0.0) -> float:
    v = gas.get(key)
    return default if v is None else float(v)


def check_zone_permits(
    zone: str,
    gas_readings: Dict[str, Any],
    permits: List[Dict[str, Any]],
    maintenance_active: bool,
    shift_changeover_active: bool,
) -> Tuple[List[PermitConflict], List[str], List[str]]:
    """
    Cross-checks every active permit in `zone` against that zone's own live
    telemetry. Returns (conflicts, clean_permit_ids, suspend_permit_ids).
    """
    conflicts: List[PermitConflict] = []
    clean: List[str] = []
    suspend: List[str] = []

    active_permits = [p for p in permits if p.get("status", "").lower() == "active"]
    active_types = [p.get("permit_type", "").lower() for p in active_permits]

    o2 = _gas_get(gas_readings, "o2", 20.9)
    co = _gas_get(gas_readings, "co")
    h2s = _gas_get(gas_readings, "h2s")
    ch4 = _gas_get(gas_readings, "ch4_lfl")

    for permit in active_permits:
        p_id = permit.get("permit_id", "UNKNOWN")
        p_type = permit.get("permit_type", "").lower()
        rules = PERMIT_RULES.get(p_type, {})
        flagged = False

        # 1. Hot work vs flammable atmosphere
        if p_type == "hot_work" and ch4 > rules.get("ch4_lfl_limit", 4.0):
            flagged = True
            severity = min(100.0, 60.0 + (ch4 - rules["ch4_lfl_limit"]) * 6.0)
            conflicts.append(PermitConflict(
                permit_id=p_id, permit_type=p_type, zone=zone,
                conflict_type="GAS_OVERLAP",
                severity_score=round(severity, 1),
                details=(
                    f"Hot Work permit '{p_id}' is an active ignition source while methane reads "
                    f"{ch4}% LFL, above the {rules['ch4_lfl_limit']}% LFL limit. Violates {rules['regulatory_ref']}."
                ),
                recommended_action="Suspend permit immediately and re-issue only after a gas-free certificate confirms CH4 < 4% LFL.",
            ))
            suspend.append(p_id)

        # 2. Confined space vs abnormal atmosphere
        if p_type == "confined_space":
            atmosphere_bad = (
                o2 < rules.get("o2_min", 19.5)
                or co > rules.get("co_limit", 15.0)
                or h2s > rules.get("h2s_limit", 3.0)
                or ch4 > rules.get("ch4_lfl_limit", 3.0)
            )
            if atmosphere_bad:
                flagged = True
                severity = 90.0
                conflicts.append(PermitConflict(
                    permit_id=p_id, permit_type=p_type, zone=zone,
                    conflict_type="GAS_OVERLAP",
                    severity_score=severity,
                    details=(
                        f"Confined Space permit '{p_id}' remains active while atmosphere is out of "
                        f"spec (O2={o2}%, CO={co}ppm, H2S={h2s}ppm, CH4={ch4}% LFL). "
                        f"Breach of {rules['regulatory_ref']}."
                    ),
                    recommended_action="Withdraw all personnel, suspend permit, and repeat atmospheric test before re-entry.",
                ))
                suspend.append(p_id)

        # 3. Documentation / procedural gap — maintenance or shift changeover
        #    running underneath a permit that requires continuous monitoring.
        if p_type in ("confined_space", "hot_work") and (maintenance_active or shift_changeover_active) and not flagged:
            flagged = True
            reason = []
            if maintenance_active:
                reason.append("active equipment maintenance")
            if shift_changeover_active:
                reason.append("an in-progress shift changeover")
            severity = 45.0 if len(reason) == 1 else 58.0
            conflicts.append(PermitConflict(
                permit_id=p_id, permit_type=p_type, zone=zone,
                conflict_type="DOCUMENTATION_GAP",
                severity_score=severity,
                details=(
                    f"Permit '{p_id}' ({p_type}) is running through {' and '.join(reason)}. "
                    f"Continuous monitoring required by {rules.get('regulatory_ref', 'OISD-STD-105')} "
                    f"is at risk of a handover gap."
                ),
                recommended_action="Assign a dedicated safety watch for the duration of the handover/maintenance window; do not rely on the outgoing shift's log alone.",
            ))

        # 4. SIMOPs clash within the same zone (mirrors Person A but scoped per-permit
        #    with a permit-issuing-authority action attached)
        if p_type == "hot_work" and "height_work" in active_types:
            flagged = True
            conflicts.append(PermitConflict(
                permit_id=p_id, permit_type=p_type, zone=zone,
                conflict_type="SIMOPS_CLASH",
                severity_score=65.0,
                details=(
                    f"Hot Work permit '{p_id}' is active in the same zone as a Height Work permit. "
                    f"Falling sparks onto personnel working below is a recognised SIMOPs hazard "
                    f"(OISD-STD-105 Annexure)."
                ),
                recommended_action="Physically segregate the two work fronts or stagger the permits so they never run concurrently.",
            ))

        if not flagged:
            clean.append(p_id)

    return conflicts, clean, list(dict.fromkeys(suspend))


def check_proximity_conflicts(
    zone: str,
    permits: List[Dict[str, Any]],
    all_zone_states: Dict[str, Dict[str, Any]],
    zone_layout: Dict[str, Any],
) -> List[PermitConflict]:
    """
    Cross-zone check: a hot-work permit in `zone` is dangerous if a
    *neighbouring* zone (within PROXIMITY_THRESHOLD plant-units) is reporting
    an elevated flammable-gas or toxic-gas condition, even if `zone` itself
    reads clean. This is the "hot work permit near elevated gas zone" case
    called out explicitly in the challenge brief.
    """
    conflicts: List[PermitConflict] = []
    if zone not in zone_layout:
        return conflicts

    active_permits = [p for p in permits if p.get("status", "").lower() == "active"]
    hot_work_permits = [p for p in active_permits if p.get("permit_type", "").lower() == "hot_work"]
    if not hot_work_permits:
        return conflicts

    my_centroid = zone_layout[zone].centroid

    for other_zone, other_state in all_zone_states.items():
        if other_zone == zone or other_zone not in zone_layout:
            continue

        other_centroid = zone_layout[other_zone].centroid
        distance = math.hypot(my_centroid[0] - other_centroid[0], my_centroid[1] - other_centroid[1])
        if distance > PROXIMITY_THRESHOLD:
            continue

        other_gas = other_state.get("gas_readings", {})
        ch4 = _gas_get(other_gas, "ch4_lfl")
        h2s = _gas_get(other_gas, "h2s")
        co = _gas_get(other_gas, "co")

        hazard_note: Optional[str] = None
        if ch4 > 4.0:
            hazard_note = f"CH4 at {ch4}% LFL"
        elif h2s > 5.0:
            hazard_note = f"H2S at {h2s} ppm"
        elif co > 50.0:
            hazard_note = f"CO at {co} ppm"

        if hazard_note:
            for permit in hot_work_permits:
                conflicts.append(PermitConflict(
                    permit_id=permit.get("permit_id", "UNKNOWN"),
                    permit_type="hot_work",
                    zone=zone,
                    conflict_type="PROXIMITY_OVERLAP",
                    severity_score=75.0,
                    details=(
                        f"Hot Work permit '{permit.get('permit_id')}' in '{zone}' is within "
                        f"{round(distance, 1)}m of '{other_zone}', which is reporting {hazard_note}. "
                        f"Gas can migrate between adjacent zones faster than permit reviews typically account for."
                    ),
                    recommended_action=f"Pause hot work until '{other_zone}' gas levels return to baseline, or install a gas curtain/monitor between the two zones.",
                    related_zone=other_zone,
                ))

    return conflicts
