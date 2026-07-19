from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging
import random

logger = logging.getLogger("risk_engine.safety_coach")

_FIRST_NAMES = ["Ravi", "Suresh", "Anil", "Priya", "Kavita", "Manoj", "Deepak", "Sunita", "Arjun", "Neha"]


class WorkerSafetyProfile:
    def __init__(self, worker_id: str, name: str, zone: str):
        self.worker_id = worker_id
        self.name = name
        self.zone = zone
        self.safety_score: float = 85.0
        self.ppe_violations: int = 0
        self.zone_violations: int = 0
        self.ignored_alerts: int = 0
        self.fatigue_score: float = 0.0
        self.risk_exposure_score: float = 0.0
        self.shift_start: Optional[str] = None
        self.last_event_at: Optional[str] = None
        self.event_history: List[Dict[str, Any]] = []
        self.recommendations: List[str] = []
        self.trend: str = "stable"
        self.last_updated: str = datetime.now().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "worker_id": self.worker_id,
            "name": self.name,
            "zone": self.zone,
            "safety_score": round(self.safety_score, 1),
            "ppe_violations": self.ppe_violations,
            "zone_violations": self.zone_violations,
            "ignored_alerts": self.ignored_alerts,
            "fatigue_score": round(self.fatigue_score, 1),
            "risk_exposure_score": round(self.risk_exposure_score, 1),
            "shift_start": self.shift_start,
            "last_event_at": self.last_event_at,
            "event_history": self.event_history[-10:],
            "recommendations": self.recommendations,
            "trend": self.trend,
            "last_updated": self.last_updated,
        }


class SafetyCoachEngine:
    def __init__(self):
        self.profiles: Dict[str, WorkerSafetyProfile] = {}
        self.event_log: List[Dict[str, Any]] = []

    def seed_from_plant_state(self, plant_state: Dict[str, Dict[str, Any]]) -> None:
        for zone_name, zstate in plant_state.items():
            history = zstate.get("restricted_entry_history", [])
            seen = set()
            for entry in history:
                wid = entry.get("worker_id")
                wname = entry.get("worker_name")
                if not wid or wid in seen:
                    continue
                seen.add(wid)
                if wid not in self.profiles:
                    self.profiles[wid] = WorkerSafetyProfile(wid, wname or wid, zone_name)

        for wid, profile in self.profiles.items():
            count = sum(1 for h in profile.event_history if h.get("event_type") == "zone_violation")
            profile.zone_violations = count
            if count >= 2:
                profile.safety_score = max(profile.safety_score - (count * 10), 20)
            profile.last_updated = datetime.now().isoformat()

    def ingest_event(self, worker_id: str, event_type: str, metadata: Optional[Dict[str, Any]] = None) -> WorkerSafetyProfile:
        if worker_id not in self.profiles:
            name = metadata.get("worker_name") if metadata else worker_id
            zone = metadata.get("zone", "Unknown") if metadata else "Unknown"
            self.profiles[worker_id] = WorkerSafetyProfile(worker_id, name, zone)

        profile = self.profiles[worker_id]
        now = datetime.now()
        ts = now.isoformat()

        if metadata and metadata.get("zone"):
            profile.zone = metadata["zone"]

        if event_type == "ppe_violation":
            profile.ppe_violations += 1
            profile.safety_score = max(profile.safety_score - 8, 0)
        elif event_type == "zone_violation":
            profile.zone_violations += 1
            profile.safety_score = max(profile.safety_score - 12, 0)
        elif event_type == "alert_ignored":
            profile.ignored_alerts += 1
            profile.safety_score = max(profile.safety_score - 5, 0)
        elif event_type == "alert_acknowledged":
            profile.safety_score = min(profile.safety_score + 1, 100)
        elif event_type == "hazard_exposure":
            profile.risk_exposure_score = min(profile.risk_exposure_score + 15, 100)
            profile.safety_score = max(profile.safety_score - 5, 0)
        elif event_type == "shift_start":
            profile.shift_start = ts
            profile.fatigue_score = 0.0
        elif event_type == "shift_end":
            profile.shift_start = None
            profile.fatigue_score = min(profile.fatigue_score + 5, 50)

        profile.last_event_at = ts
        profile.last_updated = ts

        history_entry = {
            "event_type": event_type,
            "timestamp": ts,
            "metadata": metadata or {},
        }
        profile.event_history.append(history_entry)
        if len(profile.event_history) > 50:
            profile.event_history = profile.event_history[-50:]

        self._recalculate_fatigue(profile, now)
        self._recalculate_exposure(profile, now)
        self._recalculate_score(profile)
        self._generate_recommendations(profile)
        self._update_trend(profile)

        self.event_log.append({"worker_id": worker_id, "event_type": event_type, "timestamp": ts})
        return profile

    def get_profile(self, worker_id: str) -> Optional[Dict[str, Any]]:
        if worker_id not in self.profiles:
            return None
        return self.profiles[worker_id].to_dict()

    def get_all_profiles(self) -> List[Dict[str, Any]]:
        profiles = [p.to_dict() for p in self.profiles.values()]
        profiles.sort(key=lambda x: x["safety_score"])
        return profiles

    def get_leaderboard(self, limit: int = 10) -> Dict[str, List[Dict[str, Any]]]:
        all_profiles = self.get_all_profiles()
        return {
            "most_at_risk": all_profiles[:limit],
            "safest": list(reversed(all_profiles[-limit:])) if all_profiles else [],
        }

    def _recalculate_fatigue(self, profile: WorkerSafetyProfile, now: datetime) -> None:
        if not profile.shift_start:
            profile.fatigue_score = max(profile.fatigue_score - 2, 0)
            return
        try:
            start = datetime.fromisoformat(profile.shift_start)
            hours = (now - start).total_seconds() / 3600.0
        except Exception:
            hours = 0.0

        base = min(hours * 3.5, 40.0)
        if now.hour >= 22 or now.hour < 6:
            base += 15.0
        profile.fatigue_score = min(base, 100.0)

    def _recalculate_exposure(self, profile: WorkerSafetyProfile, now: datetime) -> None:
        cutoff = now - timedelta(hours=8)
        hazard_events = [
            h for h in profile.event_history
            if h.get("event_type") == "hazard_exposure" and datetime.fromisoformat(h.get("timestamp", now.isoformat())) >= cutoff
        ]
        profile.risk_exposure_score = min(len(hazard_events) * 20, 100.0)

    def _recalculate_score(self, profile: WorkerSafetyProfile) -> None:
        score = 100.0
        score -= profile.ppe_violations * 8
        score -= profile.zone_violations * 12
        score -= profile.ignored_alerts * 5
        score -= profile.fatigue_score * 0.15
        score -= profile.risk_exposure_score * 0.1
        score = max(0.0, min(100.0, score))
        profile.safety_score = round(score, 1)

    def _generate_recommendations(self, profile: WorkerSafetyProfile) -> None:
        recs: List[str] = []
        if profile.ppe_violations >= 3:
            recs.append("Mandatory PPE compliance training assigned — supervisor must verify completion before next shift.")
        if profile.ppe_violations >= 1:
            recs.append("Random PPE checkpoint inspections scheduled for this worker during current shift.")
        if profile.zone_violations >= 2:
            recs.append("Restricted area access card temporarily suspended pending behavioral safety review.")
        if profile.zone_violations >= 1:
            recs.append("One-on-one safety briefing on zone boundaries and permit requirements.")
        if profile.ignored_alerts >= 1:
            recs.append("Alert acknowledgment protocol refresher — confirm worker understands escalation chain.")
        if profile.fatigue_score >= 50:
            recs.append("Worker removed from night-shift roster until fatigue score drops below 30.")
        if profile.fatigue_score >= 25:
            recs.append("Mandatory rest break every 2 hours enforced during current shift.")
        if profile.risk_exposure_score >= 40:
            recs.append("Rotate worker out of high-hazard zone immediately and assign low-risk task.")
        if profile.risk_exposure_score >= 20:
            recs.append("Enhanced atmospheric monitoring required when worker re-enters hazard zone.")
        if profile.safety_score < 50:
            recs.append("Place worker under direct supervisor observation for entire shift.")
        if profile.safety_score < 70 and not recs:
            recs.append("Schedule follow-up safety coaching session within 48 hours.")

        profile.recommendations = recs[:8]

    def _update_trend(self, profile: WorkerSafetyProfile) -> None:
        cutoff = datetime.now() - timedelta(hours=4)
        recent_penalties = sum(
            1 for h in profile.event_history
            if datetime.fromisoformat(h.get("timestamp", profile.last_updated or datetime.now().isoformat())) >= cutoff
            and h.get("event_type") in ("ppe_violation", "zone_violation", "alert_ignored", "hazard_exposure")
        )
        if recent_penalties >= 3:
            profile.trend = "escalating"
        elif recent_penalties == 0 and profile.safety_score >= 80:
            profile.trend = "improving"
        else:
            profile.trend = "stable"
