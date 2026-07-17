from pydantic import BaseModel, Field
from typing import List, Optional, Tuple, Dict, Any


class ZoneLayout(BaseModel):
    zone: str
    polygon: List[Tuple[float, float]] = Field(..., description="Plant-coordinate polygon (x, y) defining the zone boundary")
    centroid: Tuple[float, float]
    hazard_classification: str = Field(..., description="e.g. Confined Space, Flammable Atmosphere, Toxic Gas Storage")


class WorkerLocation(BaseModel):
    worker_id: str
    name: str
    zone: str
    x: float
    y: float
    permit_id: Optional[str] = None
    status: str = "on_site"  # on_site, evacuating, evacuated


class HeatmapZone(BaseModel):
    zone: str
    polygon: List[Tuple[float, float]]
    centroid: Tuple[float, float]
    hazard_classification: str
    risk_score: float = 0.0
    risk_level: str = "Unknown"
    color: str = "#9e9e9e"
    suspend_permits: List[str] = []
    worker_count: int = 0
    action_required: Optional[str] = None
    last_updated: Optional[str] = None


class HeatmapSnapshot(BaseModel):
    generated_at: str
    zones: List[HeatmapZone]


class AlertEvent(BaseModel):
    alert_id: str
    zone: str
    channel: str  # sms, email, slack
    recipient: str
    message: str
    sent_at: str
    status: str = "sent"


class EvacuationRecord(BaseModel):
    evacuation_id: str
    zone: str
    status: str  # evacuating, resolved
    triggered_at: str
    resolved_at: Optional[str] = None
    trigger_risk_score: float
    workers_evacuated: int = 0


class IncidentReport(BaseModel):
    report_id: str
    zone: str
    generated_at: str
    risk_level: str
    composite_risk_score: float
    factors: List[Dict[str, Any]]
    suspended_permits: List[str]
    workers_present: int
    evacuation_status: str
    regulatory_refs: List[str]
    narrative: str
    evidence_file_path: Optional[str] = None


class TriggerAlertRequest(BaseModel):
    zone: str
    reason: Optional[str] = "Manual trigger for testing"
