from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional


class FullAssessmentResponse(BaseModel):
    """
    The single 'demo flow' object Person D is responsible for: one call,
    one JSON payload, that shows the judges all four agents having spoken
    on the same zone at the same instant.
    """
    zone: str
    timestamp: str

    # Person A
    risk_assessment: Dict[str, Any] = Field(..., description="Composite risk score + factor breakdown from the Compound Risk Detection Engine")

    # Person D
    permit_audit: Dict[str, Any] = Field(..., description="Permit-vs-condition cross-check results from the Digital Permit Intelligence Agent")

    # Person B
    heatmap_zone: Optional[Dict[str, Any]] = Field(None, description="This zone's live entry on the geospatial heatmap")
    evacuation_status: str = Field("none", description="Current evacuation state machine status for this zone")
    workers_on_site: int = 0

    # Person C
    compliance_narrative: str = Field(..., description="RAG-generated historical precedent + statutory compliance analysis")
    compliance_sources: List[Dict[str, Any]] = Field(default_factory=list)
    rag_mode: str = ""

    # Person D — final synthesis
    unified_risk_score: float = Field(..., description="max(composite_risk_score, permit_risk_score) — the number the command centre acts on")
    unified_action: str = Field(..., description="Single, deduplicated action recommendation merging Person A's and Person D's outputs")
    all_flagged_permits: List[str] = Field(default_factory=list, description="Union of permits Person A and Person D both recommend suspending")
    
    # Adjacency Topology
    topology_cascade: Optional[Dict[str, Any]] = Field(None, description="Cascading risk calculations for this zone from the Plant Topology Graph")


class DemoStep(BaseModel):
    step: int
    agent: str
    title: str
    endpoint: str
    description: str


class DemoScenarioResponse(BaseModel):
    title: str
    narrative: str
    steps: List[DemoStep]
