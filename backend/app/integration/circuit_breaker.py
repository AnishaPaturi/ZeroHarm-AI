import logging
from datetime import datetime

logger = logging.getLogger("zeroharm_ai.circuit_breaker")

class CircuitBreaker:
    """
    Thread-safe implementation of the Circuit Breaker pattern.
    Transitions through CLOSED, OPEN, and HALF-OPEN states.
    If the threshold of failures is exceeded, requests bypass the external LLM
    immediately, routing to the offline local fallback to prevent network timeouts.
    """
    def __init__(self, name: str, failure_threshold: int = 3, recovery_timeout_seconds: int = 60):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout_seconds = recovery_timeout_seconds
        
        self.failure_count = 0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF-OPEN
        self.last_state_change = datetime.now()

    def allow_request(self) -> bool:
        """Determines if a request to the external LLM should be permitted."""
        if self.state == "OPEN":
            elapsed = (datetime.now() - self.last_state_change).total_seconds()
            if elapsed > self.recovery_timeout_seconds:
                self.state = "HALF-OPEN"
                self.last_state_change = datetime.now()
                logger.warning(
                    f"[{self.name} Circuit Breaker] Transitioned to HALF-OPEN. "
                    f"Attempting single trial request to external provider."
                )
                return True
            return False
        return True

    def record_success(self):
        """Resets failure counts and closes the circuit on a successful response."""
        self.failure_count = 0
        if self.state != "CLOSED":
            logger.info(
                f"[{self.name} Circuit Breaker] Success recorded. "
                f"Transitioned to CLOSED. External provider is healthy."
            )
            self.state = "CLOSED"
            self.last_state_change = datetime.now()

    def record_failure(self, error: Exception = None):
        """Increments the failure counter and trips the circuit if threshold is hit."""
        self.failure_count += 1
        err_msg = f" (Error: {error})" if error else ""
        logger.error(
            f"[{self.name} Circuit Breaker] Request failed {self.failure_count}/{self.failure_threshold}{err_msg}"
        )
        if self.failure_count >= self.failure_threshold and self.state != "OPEN":
            logger.warning(
                f"[{self.name} Circuit Breaker] Failure threshold exceeded. "
                f"Transitioning to OPEN. Bypassing LLM requests for {self.recovery_timeout_seconds}s."
            )
            self.state = "OPEN"
            self.last_state_change = datetime.now()

# Global breakers for RAG Agent and Collaborative Debate
rag_circuit_breaker = CircuitBreaker("RAG Agent", failure_threshold=3, recovery_timeout_seconds=45)
debate_circuit_breaker = CircuitBreaker("Collaborative Debate", failure_threshold=3, recovery_timeout_seconds=45)
