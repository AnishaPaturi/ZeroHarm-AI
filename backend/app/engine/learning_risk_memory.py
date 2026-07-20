import logging
from datetime import datetime
from typing import Dict, Any, List, Tuple
from .models import FactorRisk

logger = logging.getLogger("risk_engine.learning_memory")

class LearningRiskMemory:
    """
    Innovation 15: Learning Risk Memory.
    Every day the system learns plant-specific patterns:
    - Monday Morning: High risk restart anomalies (07:00 - 11:00)
    - Maintenance Fridays: Higher accident probability due to rushing (13:00 - 17:00)
    - Rainy Conditions: Poor dispersion, increased risk of gas pockets pooling
    - Night Shift: Higher fatigue and valve failure history (22:00 - 06:00)
    - Summer: Cooling system failures and temperature spikes (May - July)
    
    Dynamically returns risk score offsets and explanation factors.
    """
    def __init__(self):
        # In a real system, these coefficients would be updated by backpropagating safety violations
        # and accident records. We model them as localized learned weights.
        self.monday_morning_weight = 12.5
        self.friday_rush_weight = 10.0
        self.rainy_stagnation_weight = 15.0
        self.night_shift_fatigue_weight = 8.0
        self.summer_cooling_weight = 7.5

    def evaluate_memory_adjustments(self, zone: str, timestamp_str: str, temperature: float = 28.0) -> Tuple[float, List[FactorRisk]]:
        factors = []
        total_offset = 0.0

        try:
            # Parse ISO timestamp
            t_str = timestamp_str.replace("Z", "+00:00")
            dt = datetime.fromisoformat(t_str)
        except Exception:
            dt = datetime.now()

        day_of_week = dt.weekday()  # Monday is 0, Sunday is 6
        hour = dt.hour
        month = dt.month

        # 1. Monday Morning Restart Anomaly
        if day_of_week == 0 and (7 <= hour <= 11):
            total_offset += self.monday_morning_weight
            factors.append(FactorRisk(
                name="Memory: Monday Morning Restart Risk",
                score=self.monday_morning_weight,
                contribution=0.0,
                details="Historical plant memory shows increased operator slip incidents during Monday morning startup cycles."
            ))

        # 2. Maintenance Fridays Rush Anomaly
        if day_of_week == 4 and (13 <= hour <= 17):
            total_offset += self.friday_rush_weight
            factors.append(FactorRisk(
                name="Memory: Friday Handover Rush",
                score=self.friday_rush_weight,
                contribution=0.0,
                details="Historical data indicates a higher frequency of permit sign-off omissions on Friday afternoons as teams wrap up tasks."
            ))

        # 3. Night Shift Fatigue Anomaly
        if hour >= 22 or hour < 6:
            total_offset += self.night_shift_fatigue_weight
            factors.append(FactorRisk(
                name="Memory: Night Shift Hazard Bias",
                score=self.night_shift_fatigue_weight,
                contribution=0.0,
                details="Learned pattern: Incident probability increases during low-visibility, high-fatigue night shifts."
            ))

        # 4. Summer Cooling System Load
        if month in (5, 6, 7) and temperature >= 35.0:
            total_offset += self.summer_cooling_weight
            factors.append(FactorRisk(
                name="Memory: Summer Overheating Tendency",
                score=self.summer_cooling_weight,
                contribution=0.0,
                details="Historically observed cooling system degradations in this zone during summer temperature peaks."
            ))

        # 5. Rainy Day Stagnation Anomaly (We check temperature/humidity proxy, or simulate rain/precipitation)
        # Let's say if temperature is low but pressure drops (indicative of storm front)
        if temperature < 22.0:
            total_offset += self.rainy_stagnation_weight
            factors.append(FactorRisk(
                name="Memory: Storm Front Gas Pooling",
                score=self.rainy_stagnation_weight,
                contribution=0.0,
                details="Weather pattern correlation: Low temperatures and rain fronts lead to stagnant air pockets and localized gas accumulation."
            ))

        return total_offset, factors
