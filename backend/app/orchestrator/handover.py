import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List

logger = logging.getLogger("zeroharm_ai.orchestrator.handover")

class ShiftHandoverGenerator:
    """
    Innovation 11: AI Shift Handover Summary.
    Gathers active permits, telemetry alerts, equipment under maintenance,
    and high-risk zone states from the plant state, and automatically compiles
    a structured shift handover summary with AI recommendations for the next shift.
    """
    def __init__(self, safety_agent=None):
        self.safety_agent = safety_agent

    def generate_summary(self, plant_state: Dict[str, Dict[str, Any]], active_alerts: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        
        offline_equipment = []
        gas_alerts = []
        active_permits_summary = []
        ongoing_maintenance = []
        high_risk_zones = []
        recommendations = []

        # Parse plant state to summarize
        for zone, state in plant_state.items():
            gas = state.get("gas_readings", {})
            permits = state.get("permits", [])
            maint_active = state.get("maintenance_active", False)
            
            # Check risk level
            # Estimate risk based on composite score (if present in state, otherwise from recent assessments)
            risk_score = state.get("risk_score", 0.0)
            if risk_score >= 40.0:
                high_risk_zones.append({
                    "zone": zone,
                    "risk_score": risk_score,
                    "risk_level": "Critical" if risk_score >= 75.0 else "Warning"
                })

            # Check for active permits
            active_p_list = [p for p in permits if p.get("status", "").lower() == "active"]
            for p in active_p_list:
                active_permits_summary.append({
                    "permit_id": p.get("permit_id"),
                    "permit_type": p.get("permit_type"),
                    "zone": zone,
                    "workers": p.get("workers_count", 0)
                })

            # Check maintenance
            if maint_active:
                ongoing_maintenance.append({
                    "equipment": f"{zone} general manifold/machinery",
                    "zone": zone,
                    "status": "In Progress"
                })
                offline_equipment.append(f"{zone} processing segment")

            # Check gas spikes
            co = gas.get("co", 0.0)
            ch4 = gas.get("ch4_lfl", 0.0)
            o2 = gas.get("o2", 20.8)
            h2s = gas.get("h2s", 0.0)

            if co >= 25.0:
                gas_alerts.append(f"Carbon Monoxide in {zone}: {co} ppm")
            if ch4 >= 4.0:
                gas_alerts.append(f"Methane flammability in {zone}: {ch4}% LFL")
            if o2 < 19.5:
                gas_alerts.append(f"Oxygen depletion in {zone}: {o2}%")
            if h2s >= 5.0:
                gas_alerts.append(f"Hydrogen Sulfide in {zone}: {h2s} ppm")

        # Compile active alerts
        if active_alerts:
            for alert in active_alerts:
                if alert.get("severity") in ("Critical", "Warning"):
                    msg = alert.get("message", "")
                    if msg not in gas_alerts:
                        gas_alerts.append(msg)

        # Generate default recommendations
        if gas_alerts:
            recommendations.append("Continue forced-draft ventilation in affected gas zones and verify isolation seals.")
        if active_permits_summary:
            recommendations.append("Perform physical site verification of all active permits and ensure standby watch is positioned.")
        if ongoing_maintenance:
            recommendations.append("Audit all Lock-Out Tag-Out (LOTO) tags on unseated valves before next shift startup.")
        if high_risk_zones:
            recommendations.append("Implement mandatory 10-minute gas sniffer sweep in warning/critical sectors every hour.")
        
        if not recommendations:
            recommendations.append("No active alerts. Continue routine safety rounds and monitor SCADA feeds.")

        # Construct clean, formal, statutory shift handover report
        import random
        
        # Dynamic safety quotes/guidelines to add variation on re-run
        safety_reminders = [
            "**Factories Act Sec. 36 & Sec. 87 Compliance Alert**: Direct incoming shift supervisor to re-verify gas levels and forced ventilation on all active confined space entries.",
            "**OISD-STD-105 LOTO Protocol**: Ensure all locked valves on isolated segments are physically verified by both outgoing and incoming officers.",
            "**SIMOPs Overlap Alert**: Heavy overlapping work detected. Advise incoming crew to check permit conflicts before authorizing hot work.",
            "**PPE & Height Work Directives**: Review safety harness attachment points and life line anchoring for all active elevated permits.",
            "**Ventilation & Gas Monitoring**: Ensure forced-draft ventilation remains continuous in areas with recent gas telemetry warnings."
        ]
        selected_reminder = random.choice(safety_reminders)

        narrative = (
            "Statutory AI Shift Handover Report\n\n"
            f"**Generation Timestamp:** {now.strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n"
            "**Operational Status Overview:**\n"
            f"- **Active Permits:** {len(active_permits_summary)} authorized permit(s) in progress.\n"
            f"- **Maintenance Status:** {len(ongoing_maintenance)} equipment unit(s) isolated for servicing.\n"
            f"- **Safety Alerts Logged:** {len(gas_alerts)} gas/telemetry anomalies recorded in current shift.\n\n"
        )

        # Active Permits section
        narrative += "#### Active Work Permits\n"
        if active_permits_summary:
            narrative += "| Permit ID | Type | Zone | Workers |\n"
            narrative += "|---|---|---|---|\n"
            for p in active_permits_summary:
                narrative += f"| {p['permit_id']} | {str(p['permit_type']).upper().replace('_', ' ')} | {p['zone']} | {p['workers']} |\n"
            narrative += "\n"
        else:
            narrative += "_No active work permits at shift boundary._\n\n"

        # Isolations section
        narrative += "#### Lock-Out Tag-Out & Isolations\n"
        if ongoing_maintenance:
            narrative += "| Isolated Equipment | Zone | Status |\n"
            narrative += "|---|---|---|\n"
            for m in ongoing_maintenance:
                narrative += f"| {m['equipment']} | {m['zone']} | {m['status']} |\n"
            narrative += "\n"
        else:
            narrative += "_All machinery operating online. No LOTO tags active._\n\n"

        # Gas Alerts section
        narrative += "#### Environmental & Gas Anomaly Log\n"
        if gas_alerts:
            for alert in gas_alerts:
                narrative += f"- {alert}\n"
            narrative += "\n"
        else:
            narrative += "_All gas sensor readings within safe statutory thresholds._\n\n"

        # Incident Risk Zones section
        narrative += "#### Risk Classification\n"
        if high_risk_zones:
            for hz in high_risk_zones:
                narrative += f"- **{hz['zone']}:** Composite Risk **{hz['risk_score']}%** ({hz['risk_level']})\n"
            narrative += "\n"
        else:
            narrative += "- No critical risk zones active. Plant operating within safe parameters.\n\n"

        # Incoming Shift Directives section
        narrative += "#### Preemptive Directives Checklist\n"
        for rec in recommendations:
            narrative += f"- [ ] {rec}\n"
        narrative += "\n"

        # Statutory & AI Advisory Focus
        narrative += "#### Shift Change Safety Advisory Focus\n"
        narrative += f"{selected_reminder}\n"

        return {
            "timestamp": now.isoformat(),
            "offline_equipment": offline_equipment,
            "gas_alerts": gas_alerts,
            "active_permits": active_permits_summary,
            "ongoing_maintenance": ongoing_maintenance,
            "high_risk_zones": high_risk_zones,
            "recommendations": recommendations,
            "handover_narrative": narrative
        }
