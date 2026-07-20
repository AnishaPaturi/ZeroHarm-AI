import os
import json
import logging
from typing import Dict, Any, List

logger = logging.getLogger("zeroharm_ai.engine.feedback")

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
WEIGHTS_PATH = os.path.join(DATA_DIR, "agent_weights.json")
FEEDBACK_LOG_PATH = os.path.join(DATA_DIR, "agent_feedback_log.json")

class SelfImprovingAgentEngine:
    """
    Innovation 20: Self-Improving AI Agents.
    Enables agents to evaluate each other's decisions and update confidence weights
    dynamically based on safety supervisor overrides or incident outcomes.
    """
    def __init__(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        self.default_weights = {
            "gas_agent": 1.0,
            "permit_agent": 1.0,
            "weather_agent": 1.0,
            "cctv_agent": 1.0,
            "maintenance_agent": 1.0,
            "coordinator_agent": 1.0
        }
        self.weights = self._load_weights()

    def _load_weights(self) -> Dict[str, float]:
        if os.path.exists(WEIGHTS_PATH):
            try:
                with open(WEIGHTS_PATH, "r") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading agent weights: {e}")
        return self.default_weights.copy()

    def _save_weights(self) -> None:
        try:
            with open(WEIGHTS_PATH, "w") as f:
                json.dump(self.weights, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving agent weights: {e}")

    def get_weights(self) -> Dict[str, float]:
        return self.weights

    def ingest_feedback(self, feedback: Dict[str, Any]) -> Dict[str, Any]:
        """
        Feedback schema:
        {
            "zone": str,
            "incident_id": str,
            "disagreeing_agent_id": str,  # e.g., 'permit_agent'
            "supporting_agent_id": str,    # e.g., 'cctv_agent'
            "outcome": str,                # 'correct', 'false_positive', 'false_negative'
            "supervisor_notes": str
        }
        """
        disagree = feedback.get("disagreeing_agent_id")
        support = feedback.get("supporting_agent_id")
        outcome = feedback.get("outcome")

        # Dynamic weight reinforcement formula:
        # If an agent was right, increase weight. If wrong, decrease weight.
        adjustment_factor = 0.05
        
        if outcome == "false_positive":
            # Disagreeing agent gets penalty, supporting agent gets bonus
            if disagree in self.weights:
                self.weights[disagree] = round(max(0.1, self.weights[disagree] - adjustment_factor), 3)
            if support in self.weights:
                self.weights[support] = round(min(2.0, self.weights[support] + adjustment_factor), 3)
        elif outcome == "correct":
            # Supporting agent gets bonus
            if support in self.weights:
                self.weights[support] = round(min(2.0, self.weights[support] + adjustment_factor), 3)
            # Coordinator gets minor boost
            self.weights["coordinator_agent"] = round(min(2.0, self.weights["coordinator_agent"] + 0.02), 3)

        self._save_weights()
        self._log_feedback_item(feedback)

        return {
            "status": "success",
            "updated_weights": self.weights,
            "message": f"Agent weights updated. Self-improvement training cycle completed."
        }

    def _log_feedback_item(self, item: Dict[str, Any]) -> None:
        log_items = []
        if os.path.exists(FEEDBACK_LOG_PATH):
            try:
                with open(FEEDBACK_LOG_PATH, "r") as f:
                    log_items = json.load(f)
            except Exception:
                pass
        
        log_items.append(item)
        
        try:
            with open(FEEDBACK_LOG_PATH, "w") as f:
                json.dump(log_items, f, indent=2)
        except Exception as e:
            logger.error(f"Error logging agent feedback: {e}")
            
    def get_feedback_logs(self) -> List[Dict[str, Any]]:
        if os.path.exists(FEEDBACK_LOG_PATH):
            try:
                with open(FEEDBACK_LOG_PATH, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return []
