"""
Person D — Integration & Deliverables ("the connector + storyteller").

This module is the one place in the whole codebase that is allowed to know
about all four agents at once. Person A, B, C each stay self-contained
(engine/, geospatial/ + orchestrator/, rag/) and only get called through the
narrow interfaces main.py already exposes. This pipeline is what turns four
separate demos into a single coherent one.
"""
import logging
from datetime import datetime
from typing import Dict, Any, Optional

from .models import FullAssessmentResponse
from ..permits.agent import DigitalPermitIntelligenceAgent
from ..geospatial.topology import PlantTopology

logger = logging.getLogger("zeroharm_ai.integration.pipeline")


class ZeroHarmIntegrationPipeline:
    """
    Depends on the objects main.py already constructs at startup — it takes
    references rather than constructing its own, so there is exactly one
    instance of the heatmap engine, evacuation manager, vector store, etc.
    in the whole process.
    """

    def __init__(self, heatmap_engine, evacuation_mgr, worker_sim, safety_agent,
                 permit_agent: Optional[DigitalPermitIntelligenceAgent] = None,
                 topology_engine: Optional[PlantTopology] = None):
        self.heatmap_engine = heatmap_engine
        self.evacuation_mgr = evacuation_mgr
        self.worker_sim = worker_sim
        self.safety_agent = safety_agent
        self.permit_agent = permit_agent or DigitalPermitIntelligenceAgent()
        self.topology_engine = topology_engine or PlantTopology()

    def _merge_action(self, risk_assessment: Dict[str, Any], permit_audit) -> str:
        """Person A and Person D can each independently recommend action. Merge
        without contradicting: whichever is more severe wins; if they agree,
        don't repeat ourselves."""
        a_action = risk_assessment.get("action_required", "")
        a_score = risk_assessment.get("composite_risk_score", 0.0)
        d_score = permit_audit.permit_risk_score

        if d_score <= a_score:
            base = a_action
        else:
            base = (
                "SUSPEND FLAGGED PERMITS - Digital Permit Intelligence Agent found a permit-specific "
                "hazard the zone-level score didn't fully capture."
                if d_score >= 75.0 else
                "RE-REVIEW FLAGGED PERMITS - Permit Intelligence Agent flagged a procedural or proximity gap."
            )

        if permit_audit.conflicts:
            permit_note = f" Permit Intelligence Agent additionally flags {len(permit_audit.conflicts)} permit-level conflict(s) for review."
            return base + permit_note
        return base

    async def run_full_assessment(self, zone: str, risk_assessment: Dict[str, Any],
                                   plant_state: Dict[str, Dict[str, Any]]) -> FullAssessmentResponse:
        """
        The single 'demo flow' call: assumes Person A's risk_assessment for
        `zone` has *already* been computed (and Person B's heatmap/evacuation
        already updated from it, same as the normal /risk-score flow) —
        this just adds Person D's permit cross-check and Person C's
        compliance narrative on top, then synthesises one unified verdict.
        """
        zone_state = plant_state[zone]

        # --- Person D: permit-vs-condition cross-check (own zone + proximity) ---
        permit_audit = self.permit_agent.audit_zone(zone, zone_state, all_zone_states=plant_state)

        # --- Person B: current heatmap entry + evacuation status for this zone ---
        heatmap_zone = None
        try:
            snapshot = self.heatmap_engine.snapshot()
            for hz in snapshot.zones:
                if hz.zone == zone:
                    heatmap_zone = hz.dict()
                    break
        except Exception as e:
            logger.error(f"Could not read heatmap snapshot for '{zone}': {e}")

        evac_status = self.evacuation_mgr.status(zone)
        workers_on_site = self.worker_sim.count_on_site(zone) if self.worker_sim else 0

        # --- Person C: compliance + historical precedent narrative, informed by
        #     BOTH Person A's factors and Person D's permit conflicts ---
        factor_names = ", ".join(f.get("name", "") for f in risk_assessment.get("factors", []))
        conflict_summary = "; ".join(c.details for c in permit_audit.conflicts) if permit_audit.conflicts else "no permit-level conflicts"
        rag_query = (
            f"Zone '{zone}' composite risk factors: {factor_names or 'none'}. "
            f"Permit Intelligence Agent findings: {conflict_summary}. "
            f"Identify compliance deviations and past precedents, and recommend immediate actions."
        )
        try:
            rag_result = self.safety_agent.query(rag_query)
        except Exception as e:
            logger.error(f"RAG query failed inside integration pipeline: {e}")
            rag_result = {"answer": "Compliance narrative unavailable.", "sources": [], "mode": "error"}

        # --- Topology process risk cascades ---
        active_risks = {}
        try:
            snapshot = self.heatmap_engine.snapshot()
            for hz in snapshot.zones:
                active_risks[hz.zone] = hz.risk_score
        except Exception as e:
            logger.error(f"Could not extract risk snapshot for topology assessment: {e}")

        cascades = self.topology_engine.get_cascading_risks(active_risks)
        my_cascade = cascades.get(zone)

        # --- Person D: final synthesis across all four agents ---
        cascade_score = my_cascade.get("propagated_score", 0.0) if my_cascade else 0.0
        unified_score = round(max(
            risk_assessment.get("composite_risk_score", 0.0), 
            permit_audit.permit_risk_score,
            cascade_score
        ), 1)
        
        unified_action = self._merge_action(risk_assessment, permit_audit)
        
        if my_cascade and cascade_score > 0.0:
            sources_str = ", ".join(f"{s['source_zone']} ({s['propagated_risk']} risk via {s['connection']})" for s in my_cascade["sources"])
            unified_action += f" WARNING: Process topology indicates active cascading risk of {cascade_score} from upstream: {sources_str}."

        all_flagged = list(dict.fromkeys(
            list(risk_assessment.get("suspend_permits", [])) + list(permit_audit.suspend_permits)
        ))

        # If cascading risk is elevated (Warning or Critical), recommend suspending active permits in this zone
        if cascade_score >= 40.0:
            active_permit_ids = [p.get("permit_id") for p in zone_state.get("permits", []) if p.get("status", "").lower() == "active"]
            all_flagged.extend(active_permit_ids)
            all_flagged = list(dict.fromkeys(all_flagged))

        return FullAssessmentResponse(
            zone=zone,
            timestamp=datetime.now().isoformat(),
            risk_assessment=risk_assessment,
            permit_audit=permit_audit.dict(),
            heatmap_zone=heatmap_zone,
            evacuation_status=evac_status,
            workers_on_site=workers_on_site,
            compliance_narrative=rag_result.get("answer", ""),
            compliance_sources=rag_result.get("sources", []),
            rag_mode=rag_result.get("mode", ""),
            unified_risk_score=unified_score,
            unified_action=unified_action,
            all_flagged_permits=all_flagged,
            topology_cascade=my_cascade,
        )
