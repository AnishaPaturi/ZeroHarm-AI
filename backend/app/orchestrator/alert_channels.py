import logging
import os
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.text import MIMEText
from typing import List

import requests

from ..geospatial.models import AlertEvent

logger = logging.getLogger("orchestrator.alerts")

# In-memory alert log (swap for a DB in production).
_alert_log: List[AlertEvent] = []

_ON_CALL_ROSTER = {
    "sms": os.getenv("ALERT_SMS_TO", "+91-98XXXXXX01 (Shift Safety Officer)"),
    "email": os.getenv("ALERT_EMAIL_TO", "safety-command-center@plant.local"),
    "slack": "#plant-emergency-response",
}


def _record(channel: str, zone: str, message: str, status: str) -> AlertEvent:
    event = AlertEvent(
        alert_id=str(uuid.uuid4())[:8],
        zone=zone,
        channel=channel,
        recipient=_ON_CALL_ROSTER[channel],
        message=message,
        sent_at=datetime.now(timezone.utc).isoformat(),
        status=status,
    )
    _alert_log.append(event)
    return event


def _send_sms(zone: str, message: str) -> AlertEvent:
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_FROM_NUMBER")
    to_number = os.getenv("ALERT_SMS_TO", "").replace(" ", "")  # strip stray whitespace

    if not (sid and token and from_number and to_number):
        logger.info(f"[SIMULATED SMS] -> {_ON_CALL_ROSTER['sms']}: {message}")
        return _record("sms", zone, message, "simulated")

    try:
        from twilio.rest import Client  # lazy import so it's optional if unused

        client = Client(sid, token)
        client.messages.create(body=message, from_=from_number, to=to_number)
        logger.info(f"[SMS SENT] -> {to_number}")
        return _record("sms", zone, message, "sent")
    except Exception as exc:
        logger.error(f"[SMS FAILED] {exc}")
        return _record("sms", zone, message, "failed")


def _send_email(zone: str, message: str) -> AlertEvent:
    host = os.getenv("SMTP_HOST")
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    to_addr = os.getenv("ALERT_EMAIL_TO")

    if not (host and user and password and to_addr):
        logger.info(f"[SIMULATED EMAIL] -> {_ON_CALL_ROSTER['email']}: {message}")
        return _record("email", zone, message, "simulated")

    try:
        msg = MIMEText(message)
        msg["Subject"] = f"[ZeroHarm ALERT] Zone: {zone}"
        msg["From"] = user
        msg["To"] = to_addr

        with smtplib.SMTP(host, 587, timeout=10) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(user, [to_addr], msg.as_string())

        logger.info(f"[EMAIL SENT] -> {to_addr}")
        return _record("email", zone, message, "sent")
    except Exception as exc:
        logger.error(f"[EMAIL FAILED] {exc}")
        return _record("email", zone, message, "failed")


def _send_slack(zone: str, message: str) -> AlertEvent:
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")

    if not webhook_url:
        logger.info(f"[SIMULATED SLACK] -> {_ON_CALL_ROSTER['slack']}: {message}")
        return _record("slack", zone, message, "simulated")

    try:
        payload = {"text": f"*[ZeroHarm ALERT]* Zone: `{zone}`\n{message}"}
        resp = requests.post(webhook_url, json=payload, timeout=10)
        resp.raise_for_status()
        logger.info("[SLACK SENT]")
        return _record("slack", zone, message, "sent")
    except Exception as exc:
        logger.error(f"[SLACK FAILED] {exc}")
        return _record("slack", zone, message, "failed")


_DISPATCHERS = {
    "sms": _send_sms,
    "email": _send_email,
    "slack": _send_slack,
}


_ALERTABLE_SEVERITIES = {"critical", "warning"}


def dispatch_all_channels(zone: str, message: str, severity: str = "critical") -> List[AlertEvent]:
    """Fires the message across SMS, email, and Slack simultaneously.

    Only dispatches for severities in _ALERTABLE_SEVERITIES (critical, warning
    by default). Anything else (e.g. "info", "low") is logged but not sent,
    so low-priority events don't spam the on-call channels.

    Each channel independently falls back to simulated/logged mode if its
    required env vars aren't configured, so this is safe to call in dev too.
    """
    severity = severity.lower()
    if severity not in _ALERTABLE_SEVERITIES:
        logger.info(f"[SKIPPED] severity={severity} below alert threshold for zone={zone}")
        return []

    return [_DISPATCHERS[channel](zone, message) for channel in ("sms", "email", "slack")]


def get_alert_log(zone: str = None, limit: int = 50) -> List[AlertEvent]:
    events = _alert_log
    if zone:
        events = [e for e in events if e.zone == zone]
    return events[-limit:]