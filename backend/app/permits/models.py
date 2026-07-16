from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class PermitConflict(BaseModel):
    """A single dangerous permit-vs-condition combination flagged by the agent."""
    permit_id: str = Field(..., description="Permit that triggered the conflict")
    permit_type: str = Field(..., description="Type of permit: hot_work, confined_space, height_work, cold_work")
    zone: str = Field(..., description="Zone the permit is active in")
    conflict_type: str = Field(..., description="Category of conflict, e.g. GAS_OVERLAP, SIMOPS_CLASH, PROXIMITY_OVERLAP, DOCUMENTATION_GAP")
    severity_score: float = Field(..., description="0-100 severity of this specific conflict")
    details: str = Field(..., description="Human-readable explanation with the regulatory reference")
    recommended_action: str = Field(..., description="Immediate action the permit issuing authority should take")
    related_zone: Optional[str] = Field(None, description="Set for cross-zone/proximity conflicts: the neighbouring zone driving the hazard")


class PermitAuditResponse(BaseModel):
    zone: str
    permits_checked: int
    conflicts: List[PermitConflict]
    clean_permits: List[str] = Field(..., description="Permit IDs that passed the cross-check with no flags")
    permit_risk_score: float = Field(..., description="Aggregate 0-100 risk score derived purely from permit-vs-condition analysis")
    suspend_permits: List[str] = Field(..., description="Permit IDs the agent recommends suspending immediately")
    timestamp: str


class PermitAuditRequest(BaseModel):
    zone: str = Field(..., description="Zone to audit. Uses the live simulated plant_state for that zone.")


class FullPlantPermitAuditResponse(BaseModel):
    generated_at: str
    zones_audited: int
    total_conflicts: int
    audits: List[PermitAuditResponse]
