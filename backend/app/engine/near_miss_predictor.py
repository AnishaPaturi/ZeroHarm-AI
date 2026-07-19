from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger("risk_engine.near_miss")

SHIFT_DURATION_HOURS = 8


def _parse_ts(ts_str: str) -> datetime:
    try:
        return datetime.fromisoformat(ts_str)
    except Exception:
        return datetime.min


def _entries_in_window(history: List[Dict[str, Any]], now: datetime, window_hours: float) -> List[Dict[str, Any]]:
    cutoff = now - timedelta(hours=window_hours)
    return [h for h in history if _parse_ts(h.get("timestamp", "")) >= cutoff]


class NearMissPredictionEngine:
    def __init__(self):
        self.prediction_log: List[Dict[str, Any]] = []

    def predict(self, zone: str, zone_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        now = datetime.now()
        history: List[Dict[str, Any]] = zone_state.get("restricted_entry_history", [])
        count: int = zone_state.get("restricted_entry_count", 0)
        gas: Dict[str, Any] = zone_state.get("gas_readings", {})
        permits: List[Dict[str, Any]] = zone_state.get("permits", [])
        maintenance: bool = zone_state.get("maintenance_active", False)
        shift_changeover: bool = zone_state.get("shift_changeover_active", False)

        if count < 2:
            return None

        frequency_score = self._frequency_score(history, now)
        acceleration_score = self._acceleration_score(history, now)
        environmental_score = self._environmental_score(gas, permits, maintenance, shift_changeover)
        worker_pattern_score = self._worker_pattern_score(history)
        time_risk_score = self._time_risk_score(history, now)

        probability = min(100.0, frequency_score + acceleration_score + environmental_score + worker_pattern_score + time_risk_score)

        if probability >= 80:
            severity = "Critical"
        elif probability >= 60:
            severity = "High"
        elif probability >= 40:
            severity = "Medium"
        else:
            severity = "Low"

        confidence = min(95.0, 45.0 + (count * 8.0) + (len(history) * 1.5))
        confidence = round(confidence, 1)

        root_causes = self._build_root_causes(count, environmental_score, acceleration_score, worker_pattern_score, shift_changeover, gas)
        recommendations = self._build_recommendations(severity, environmental_score, maintenance)
        prediction_text = self._prediction_text(probability, severity)

        recent_workers = [h.get("worker_name", "Unknown") for h in history[-5:]]
        unique_workers = len({h.get("worker_id") for h in history if h.get("worker_id")})

        prediction = {
            "zone": zone,
            "prediction_timestamp": now.isoformat(),
            "predicted_incident_probability": round(probability, 1),
            "severity": severity,
            "prediction_horizon": "next_shift",
            "prediction": prediction_text,
            "root_causes": root_causes,
            "recommendations": recommendations,
            "confidence_score": confidence,
            "trend": "escalating" if acceleration_score > 0 else ("stable" if count >= 3 else "nominal"),
            "entry_count": count,
            "unique_workers_identified": unique_workers,
            "recent_workers": recent_workers,
            "history": history[-10:],
            "factors": {
                "frequency_score": round(frequency_score, 1),
                "acceleration_score": round(acceleration_score, 1),
                "environmental_score": round(environmental_score, 1),
                "worker_pattern_score": round(worker_pattern_score, 1),
                "time_risk_score": round(time_risk_score, 1),
            },
        }

        self.prediction_log.append(prediction)
        return prediction

    def _frequency_score(self, history: List[Dict[str, Any]], now: datetime) -> float:
        recent = _entries_in_window(history, now, SHIFT_DURATION_HOURS)
        total = len(recent)
        if total >= 4:
            return 85.0
        elif total == 3:
            return 70.0
        elif total == 2:
            return 55.0
        elif total == 1:
            return 30.0
        return 10.0

    def _acceleration_score(self, history: List[Dict[str, Any]], now: datetime) -> float:
        if len(history) < 3:
            return 0.0
        recent = _entries_in_window(history, now, 2.0)
        older = _entries_in_window(history, now, 4.0)
        older = [e for e in older if _parse_ts(e.get("timestamp", "")) < now - timedelta(hours=2)]
        if len(recent) > len(older) and len(recent) >= 2:
            return 15.0
        return 0.0

    def _environmental_score(self, gas: Dict[str, Any], permits: List[Dict[str, Any]], maintenance: bool, shift_changeover: bool) -> float:
        score = 0.0
        co = float(gas.get("co", 0.0))
        ch4 = float(gas.get("ch4_lfl", 0.0))
        o2 = float(gas.get("o2", 20.8))
        h2s = float(gas.get("h2s", 0.0))

        if co > 35.0:
            score += 12.0
        elif co > 15.0:
            score += 6.0

        if ch4 > 5.0:
            score += 12.0
        elif ch4 > 2.0:
            score += 6.0

        if o2 < 19.0:
            score += 8.0
        elif o2 < 19.5:
            score += 4.0

        if h2s > 10.0:
            score += 5.0
        elif h2s > 5.0:
            score += 2.0

        active_permits = [p for p in permits if p.get("status", "").lower() == "active"]
        if active_permits:
            score += 5.0

        if maintenance:
            score += 5.0

        if shift_changeover:
            score += 5.0

        return min(score, 35.0)

    def _worker_pattern_score(self, history: List[Dict[str, Any]]) -> float:
        if not history:
            return 0.0
        ids = [h.get("worker_id") for h in history if h.get("worker_id")]
        unique = set(ids)
        if len(ids) >= 3 and len(unique) == 1:
            return 10.0
        if len(ids) >= 2 and len(unique) <= 2:
            return 5.0
        return 0.0

    def _time_risk_score(self, history: List[Dict[str, Any]], now: datetime) -> float:
        score = 0.0
        if not history:
            return score
        for h in history[-3:]:
            ts = _parse_ts(h.get("timestamp", ""))
            hour = ts.hour
            if 6 <= hour <= 8 or 18 <= hour <= 20:
                score += 3.0
        return min(score, 6.0)

    def _build_root_causes(self, count: int, env_score: float, acc_score: float, worker_score: float, shift_changeover: bool, gas: Dict[str, Any]) -> List[str]:
        causes = []
        if count >= 2:
            causes.append(f"Repeated unauthorized access attempts ({count} entries logged in current shift)")
        if env_score > 15:
            causes.append("Concurrent environmental hazards significantly amplify exposure risk in restricted zone")
        if acc_score > 0:
            causes.append("Escalating entry frequency detected — behavioral pattern worsening over time")
        if worker_score > 0:
            causes.append("Same worker(s) repeatedly breaching access — possible procedural non-compliance")
        if shift_changeover:
            causes.append("Shift changeover active — handover communication gap may reduce vigilance")
        gas_o2 = float(gas.get("o2", 20.8))
        gas_co = float(gas.get("co", 0.0))
        gas_ch4 = float(gas.get("ch4_lfl", 0.0))
        if gas_o2 < 19.5 or gas_co > 25.0 or gas_ch4 > 3.0:
            causes.append("Atmospheric conditions in restricted zone are outside safe operational thresholds")
        return causes

    def _build_recommendations(self, severity: str, env_score: float, maintenance: bool) -> List[str]:
        recs = [
            "Enforce gatehouse biometric access control and physical barrier reinforcement for restricted zone",
            "Assign dedicated supervisor for mandatory safety walkthrough at start of next shift",
            "Review CCTV blind spots and ensure continuous monitoring coverage of all entry vectors",
        ]
        if env_score > 10:
            recs.append("Conduct immediate environmental hazard audit and atmospheric re-testing before re-entry")
        if severity in ("Critical", "High"):
            recs.append("Issue temporary zone lockdown order until root-cause behavioral compliance is verified")
        if maintenance:
            recs.append("Complete maintenance activities before lifting access restrictions")
        return recs

    def _prediction_text(self, probability: float, severity: str) -> str:
        if severity == "Critical":
            return "High probability of serious incident within next shift. Immediate safety intervention required."
        if severity == "High":
            return "Elevated risk of near-miss or incident during upcoming shift. Precautionary measures advised."
        if severity == "Medium":
            return "Behavioral pattern detected indicating potential safety breach if uncorrected before next shift."
        return "Low-level behavioral anomaly logged. Continued monitoring recommended."
