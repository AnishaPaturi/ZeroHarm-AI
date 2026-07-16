import uuid
from datetime import datetime, timezone
from typing import List

from ..geospatial.models import IncidentReport

_reports: List[IncidentReport] = []

_REGULATORY_REFS = [
    "Factory Act 1948 - Sec. 21 (Fencing of dangerous machinery) / Sec. 87 (Dangerous operations)",
    "OISD-STD-105 - Work Permit Systems",
    "DGMS Circular - Emergency Preparedness & Response",
]


def generate_report(zone: str, risk_assessment: dict, evacuation_record) -> IncidentReport:
    report = IncidentReport(
        report_id=f"INC-{str(uuid.uuid4())[:8].upper()}",
        zone=zone,
        generated_at=datetime.now(timezone.utc).isoformat(),
        risk_level=risk_assessment.get("risk_level", "Unknown"),
        composite_risk_score=risk_assessment.get("composite_risk_score", 0.0),
        factors=risk_assessment.get("factors", []),
        suspended_permits=risk_assessment.get("suspend_permits", []),
        workers_present=evacuation_record.workers_evacuated if evacuation_record else 0,
        evacuation_status=evacuation_record.status if evacuation_record else "none",
        regulatory_refs=_REGULATORY_REFS,
        narrative=_build_narrative(zone, risk_assessment, evacuation_record),
    )
    _reports.append(report)
    return report


def _build_narrative(zone: str, risk_assessment: dict, evacuation_record) -> str:
    factor_names = ", ".join(f.get("name", "") for f in risk_assessment.get("factors", [])) or "no specific factor breakdown available"
    return (
        f"Preliminary auto-generated incident report for zone '{zone}'. "
        f"Compound Risk Detection Engine flagged a composite risk score of "
        f"{risk_assessment.get('composite_risk_score', 'N/A')} ({risk_assessment.get('risk_level', 'Unknown')}). "
        f"Contributing factors: {factor_names}. "
        f"Recommended action at time of trigger: {risk_assessment.get('action_required', 'N/A')}. "
        f"Evacuation status: {evacuation_record.status if evacuation_record else 'none'}, "
        f"{evacuation_record.workers_evacuated if evacuation_record else 0} worker(s) moved to evacuated status. "
        f"This report is preliminary and generated automatically within seconds of the triggering event; "
        f"it must be reviewed and countersigned by the site Safety Officer before regulatory submission."
    )


def get_reports(zone: str = None, limit: int = 50) -> List[IncidentReport]:
    reports = _reports
    if zone:
        reports = [r for r in reports if r.zone == zone]
    return reports[-limit:]
