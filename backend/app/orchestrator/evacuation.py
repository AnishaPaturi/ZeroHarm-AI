import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional

from ..geospatial.models import EvacuationRecord
from .alert_channels import dispatch_all_channels

logger = logging.getLogger("orchestrator.evacuation")


class EvacuationManager:
    """
    Per-zone evacuation state machine:
        (no record) -> evacuating -> resolved -> evacuating -> ...

    Driven by risk_level coming from Person A's risk feed:
      - "Critical" arrives while zone isn't already evacuating -> ALERT + start evacuation
      - "Warning" arrives while zone isn't already evacuating -> ALERT (no evacuation start)
      - "Safe" or "Warning" arrives while zone is evacuating -> RESOLVE
    """

    def __init__(self, worker_simulator=None, incident_report_generator=None):
        self._records: Dict[str, EvacuationRecord] = {}
        self._worker_simulator = worker_simulator
        self._incident_report_generator = incident_report_generator

    def status(self, zone: str) -> str:
        rec = self._records.get(zone)
        return rec.status if rec else "none"

    def handle_risk_update(self, zone: str, risk_assessment: dict) -> Optional[EvacuationRecord]:
        risk_level = risk_assessment.get("risk_level")
        score = risk_assessment.get("composite_risk_score", 0.0)
        current_status = self.status(zone)

        if risk_level == "Critical" and current_status != "evacuating":
            return self._trigger(zone, risk_assessment, score)

        if risk_level in ("Safe", "Warning") and current_status == "evacuating":
            return self._resolve(zone, risk_level)

        if risk_level == "Warning" and current_status != "evacuating":
            self._notify_warning(zone, risk_assessment, score)

        return self._records.get(zone)

    def _trigger(self, zone: str, risk_assessment: dict, score: float) -> EvacuationRecord:
        evac_id = str(uuid.uuid4())[:8]
        now = datetime.now(timezone.utc).isoformat()
        record = EvacuationRecord(
            evacuation_id=evac_id,
            zone=zone,
            status="evacuating",
            triggered_at=now,
            trigger_risk_score=score,
        )
        self._records[zone] = record
        logger.warning(f"EVACUATION TRIGGERED for zone '{zone}' (score={score}).")

        message = (
            f"[CRITICAL] Evacuation triggered for '{zone}'. "
            f"Composite risk score: {score}. {risk_assessment.get('action_required', '')}"
        )
        dispatch_all_channels(zone, message, severity="critical")

        if self._worker_simulator:
            self._worker_simulator.mark_zone_evacuating(zone)
            record.workers_evacuated = self._worker_simulator.mark_zone_evacuated(zone)

        if self._incident_report_generator:
            self._incident_report_generator(zone, risk_assessment, record)

        return record

    def _notify_warning(self, zone: str, risk_assessment: dict, score: float) -> None:
        """Elevated risk, but not yet critical enough to force an evacuation.
        Still fires all alert channels so the on-call team has a heads-up."""
        logger.warning(f"WARNING level risk for zone '{zone}' (score={score}) — alert sent, evacuation not triggered.")

        message = (
            f"[WARNING] Elevated risk detected in '{zone}'. "
            f"Composite risk score: {score}. {risk_assessment.get('action_required', '')}"
        )
        dispatch_all_channels(zone, message, severity="warning")

    def _resolve(self, zone: str, risk_level: str) -> EvacuationRecord:
        record = self._records[zone]
        record.status = "resolved"
        record.resolved_at = datetime.now(timezone.utc).isoformat()
        logger.info(f"Zone '{zone}' risk level dropped to '{risk_level}' — evacuation marked resolved.")

        if self._worker_simulator:
            self._worker_simulator.mark_zone_resolved(zone)

        dispatch_all_channels(
            zone,
            f"[RESOLVED] Zone '{zone}' risk level has dropped. Stand down / re-entry authorized.",
            severity="warning",
        )
        return record

    def all_records(self):
        return list(self._records.values())