from pydantic import BaseModel, Field
from typing import List, Optional

class GasReadings(BaseModel):
    o2: float = Field(..., description="Oxygen concentration in % (Normal: 19.5% - 23.5%)")
    co: float = Field(..., description="Carbon Monoxide concentration in ppm (Normal: < 25)")
    ch4_lfl: float = Field(..., description="Methane concentration in % LFL (Normal: < 5%)")
    h2s: float = Field(..., description="Hydrogen Sulfide concentration in ppm (Normal: < 5)")
    temperature: Optional[float] = Field(None, description="Ambient temperature in Celsius")
    pressure: Optional[float] = Field(None, description="Atmospheric or line pressure in bar")
    d_co_dt: Optional[float] = Field(0.0, description="Rate of change of Carbon Monoxide in ppm/s")
    d_pressure_dt: Optional[float] = Field(0.0, description="Rate of change of pressure in bar/s")

class PermitInfo(BaseModel):
    permit_id: str = Field(..., description="Unique permit identifier")
    permit_type: str = Field(..., description="Type of permit: hot_work, confined_space, height_work, cold_work")
    status: str = Field(..., description="Status of the permit: active, suspended, completed")
    zone: str = Field(..., description="Zone where the permit is active")
    workers_count: int = Field(0, description="Number of workers currently operating under this permit")

class FactorRisk(BaseModel):
    name: str = Field(..., description="Name of the risk factor (e.g. Asphyxiation Risk, SIMOPs Overlap)")
    score: float = Field(..., description="Risk score contributed by this factor (0 - 100)")
    contribution: float = Field(..., description="Percentage contribution of this factor to the score")
    details: str = Field(..., description="Detailed description of the risk assessment for this factor")

class CCTVAlert(BaseModel):
    zone: str = Field(..., description="Zone where the alert was triggered")
    event_type: str = Field(..., description="Type of event: no_ppe, smoke_detected, unauthorized_entry, fire_detected")
    confidence: float = Field(..., description="Detection confidence score between 0.0 and 1.0")
    timestamp: str = Field(..., description="Timestamp of the event in ISO format")
    worker_id: Optional[str] = Field(None, description="Optional ID of the worker")
    worker_name: Optional[str] = Field(None, description="Optional name of the worker")

class RiskCheckRequest(BaseModel):
    zone: str = Field(..., description="Zone being checked (e.g., Coke Oven Battery 1)")
    gas_readings: GasReadings = Field(..., description="Telemetry from gas sensors in this zone")
    permits: List[PermitInfo] = Field([], description="List of active permits in this zone")
    maintenance_active: bool = Field(False, description="Is general maintenance active in this zone")
    shift_changeover_active: bool = Field(False, description="Is a shift changeover currently in progress")
    cctv_alerts: List[CCTVAlert] = Field([], description="List of active CCTV alerts in this zone")
    restricted_entry_count: int = Field(0, description="Number of unauthorized entries in this zone")
    timestamp: str = Field(..., description="Timestamp of the reading in ISO format")

class RiskCheckResponse(BaseModel):
    zone: str = Field(..., description="Zone evaluated")
    composite_risk_score: float = Field(..., description="Final combined risk score (0.0 - 100.0)")
    risk_level: str = Field(..., description="Categorical risk level: Safe, Warning, Critical")
    rule_score: float = Field(..., description="Risk score calculated by the deterministic rules engine")
    ml_score: float = Field(..., description="Risk score calculated by the ML anomaly detection model")
    factors: List[FactorRisk] = Field(..., description="Breakdown of individual risk factors")
    action_required: str = Field(..., description="Recommended immediate action for the safety command center")
    suspend_permits: List[str] = Field(..., description="IDs of permits recommended for immediate suspension")
    timestamp: str = Field(..., description="ISO timestamp of evaluation")
