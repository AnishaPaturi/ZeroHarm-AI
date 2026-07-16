import logging
import uuid
from datetime import datetime, timezone
from typing import List

from ..geospatial.models import AlertEvent

logger = logging.getLogger("orchestrator.alerts")

# In-memory alert log (swap for a DB in production; a real integration would
# call Twilio/SendGrid/Slack webhook APIs here instead of just logging).
_alert_log: List[AlertEvent] = []

_ON_CALL_ROSTER = {
    "sms": "+91-98XXXXXX01 (Shift Safety Officer)",
    "email": "safety-command-center@plant.local",
    "slack": "#plant-emergency-response",
}


def _dispatch(channel: str, zone: str, message: str) -> AlertEvent:
    event = AlertEvent(
        alert_id=str(uuid.uuid4())[:8],
        zone=zone,
        channel=channel,
        recipient=_ON_CALL_ROSTER[channel],
        message=message,
        sent_at=datetime.now(timezone.utc).isoformat(),
        status="sent",
    )
    _alert_log.append(event)
    logger.info(f"[SIMULATED {channel.upper()}] -> {event.recipient}: {message}")
    return event


def dispatch_all_channels(zone: str, message: str) -> List[AlertEvent]:
    """Fires the message across SMS, email, and Slack simultaneously (simulated)."""
    return [_dispatch(channel, zone, message) for channel in ("sms", "email", "slack")]


def get_alert_log(zone: str = None, limit: int = 50) -> List[AlertEvent]:
    events = _alert_log
    if zone:
        events = [e for e in events if e.zone == zone]
    return events[-limit:]
