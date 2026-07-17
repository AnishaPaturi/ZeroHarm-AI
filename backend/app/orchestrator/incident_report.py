import uuid
import os
import json
import stat
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from ..geospatial.models import IncidentReport

_reports: List[IncidentReport] = []

_REGULATORY_REFS = [
    "Factory Act 1948 - Sec. 21 (Fencing of dangerous machinery) / Sec. 87 (Dangerous operations)",
    "OISD-STD-105 - Work Permit Systems",
    "DGMS Circular - Emergency Preparedness & Response",
]

EVIDENCE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "evidence")


def fetch_risk_history_from_api(zone: str) -> List[Dict[str, Any]]:
    """
    Fetches the risk history from the local API endpoint /api/risk-history.
    """
    try:
        encoded_zone = urllib.parse.quote(zone)
        url = f"http://127.0.0.1:8000/api/risk-history?limit=100&zone={encoded_zone}"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=2) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception:
        return []


def preserve_black_box_evidence(zone: str, report_id: str, history: List[Dict[str, Any]] = None) -> str:
    """
    Person B Emergency Response Orchestrator / Black Box:
    Extracts preceding 10-minute sensor telemetry logs for the affected zone
    from the local /api/risk-history endpoint (falling back to passed history)
    and dumps them into a sealed, read-only JSON file representing a
    tamper-proof "Flight Data Recorder" block.
    """
    api_history = fetch_risk_history_from_api(zone)
    combined_history = api_history if api_history else (history or [])

    now = datetime.now(timezone.utc)
    filtered_history = []

    for entry in combined_history:
        if entry.get("zone") != zone:
            continue

        entry_time_str = entry.get("timestamp")
        if not entry_time_str:
            continue

        try:
            # Parse ISO timestamp compatibility
            t_str = entry_time_str.replace("Z", "+00:00")
            entry_time = datetime.fromisoformat(t_str)
            if entry_time.tzinfo is None:
                # Naive local timestamp: localize it to local timezone before converting to UTC
                entry_time = entry_time.astimezone(timezone.utc)
            else:
                entry_time = entry_time.astimezone(timezone.utc)

            # Keep only entries within the last 10 minutes (600 seconds)
            delta = (now - entry_time).total_seconds()
            if 0 <= delta <= 600:
                filtered_history.append(entry)
        except Exception:
            # Fallback to appending if parsing fails but it matches zone
            filtered_history.append(entry)

    # Prepare evidence dump structure
    evidence_package = {
        "metadata": {
            "incident_report_id": report_id,
            "zone": zone,
            "recorded_at": now.isoformat(),
            "record_count": len(filtered_history),
            "regulatory_mandate": "Factories Act Section 88 / OISD standards evidence preservation",
            "description": "Sealed SCADA telemetry and risk factors recording for safety investigation."
        },
        "sensor_history": filtered_history
    }

    os.makedirs(EVIDENCE_DIR, exist_ok=True)

    # Safe filename generation
    zone_clean = zone.lower().replace(" ", "_").replace("/", "_")
    timestamp_clean = now.strftime("%Y%m%d_%H%M%S")
    filename = f"blackbox_{zone_clean}_{report_id}_{timestamp_clean}.json"
    filepath = os.path.join(EVIDENCE_DIR, filename)

    # Write evidence file
    with open(filepath, "w") as f:
        json.dump(evidence_package, f, indent=2)

    # Make the file read-only (sealed) to represent tamper-proof logging
    try:
        os.chmod(filepath, stat.S_IREAD)
    except Exception:
        pass  # ignore chmod errors if permissions restrict it

    return filepath


def generate_report(zone: str, risk_assessment: dict, evacuation_record, risk_history_list: List[Dict[str, Any]] = None) -> IncidentReport:
    report_id = f"INC-{str(uuid.uuid4())[:8].upper()}"

    evidence_path = None
    if risk_history_list:
        try:
            evidence_path = preserve_black_box_evidence(zone, report_id, risk_history_list)
        except Exception as e:
            evidence_path = f"Error preserving evidence: {str(e)}"

    report = IncidentReport(
        report_id=report_id,
        zone=zone,
        generated_at=datetime.now(timezone.utc).isoformat(),
        risk_level=risk_assessment.get("risk_level", "Unknown"),
        composite_risk_score=risk_assessment.get("composite_risk_score", 0.0),
        factors=risk_assessment.get("factors", []),
        suspended_permits=risk_assessment.get("suspend_permits", []),
        workers_present=evacuation_record.workers_evacuated if evacuation_record else 0,
        evacuation_status=evacuation_record.status if evacuation_record else "none",
        regulatory_refs=_REGULATORY_REFS,
        narrative=_build_narrative(zone, risk_assessment, evacuation_record, evidence_path),
        evidence_file_path=evidence_path,
    )
    _reports.append(report)
    return report


def _build_narrative(zone: str, risk_assessment: dict, evacuation_record, evidence_path: str = None) -> str:
    factor_names = ", ".join(f.get("name", "") for f in risk_assessment.get("factors", [])) or "no specific factor breakdown available"
    narrative = (
        f"Preliminary auto-generated incident report for zone '{zone}'. "
        f"Compound Risk Detection Engine flagged a composite risk score of "
        f"{risk_assessment.get('composite_risk_score', 'N/A')} ({risk_assessment.get('risk_level', 'Unknown')}). "
        f"Contributing factors: {factor_names}. "
        f"Recommended action at time of trigger: {risk_assessment.get('action_required', 'N/A')}. "
        f"Evacuation status: {evacuation_record.status if evacuation_record else 'none'}, "
        f"{evacuation_record.workers_evacuated if evacuation_record else 0} worker(s) moved to evacuated status. "
    )
    if evidence_path:
        narrative += f"SCADA sensor evidence has been sealed in the flight data recorder block at: {evidence_path}. "
    else:
        narrative += "No historical sensor evidence preserved for this trigger. "

    narrative += (
        "This report is preliminary and generated automatically within seconds of the triggering event; "
        "it must be reviewed and countersigned by the site Safety Officer before regulatory submission."
    )
    return narrative


def get_reports(zone: str = None, limit: int = 50) -> List[IncidentReport]:
    reports = _reports
    if zone:
        reports = [r for r in reports if r.zone == zone]
    return reports[-limit:]
