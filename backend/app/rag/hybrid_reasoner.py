import logging
from typing import Dict, Any, List
from .agent import ZeroHarmSafetyAgent
from ..knowledge_graph.graph import RiskKnowledgeGraph

logger = logging.getLogger("zeroharm_ai.rag.hybrid_reasoner")

class RAGKnowledgeGraphHybridReasoner:
    """
    Innovation 18: Risk Memory using RAG + Knowledge Graph.
    Instead of retrieving similar reports individually, this reasoner fuses
    text RAG queries with graph traversals:
    Current Event -> Similar Incident -> Equipment Similarity -> Weather Similarity -> Root Cause Similarity -> Prevention.
    """
    def __init__(self, safety_agent: ZeroHarmSafetyAgent, risk_graph: RiskKnowledgeGraph):
        self.safety_agent = safety_agent
        self.risk_graph = risk_graph

    def run_hybrid_reasoning(self, zone: str, risk_assessment: Dict[str, Any]) -> Dict[str, Any]:
        # 1. Standard RAG retrieve
        factor_names = ", ".join(f.get("name", "") for f in risk_assessment.get("factors", []))
        rag_query = f"Retrieve similar incidents and root causes for {zone} showing {factor_names or 'normal telemetry'}"
        
        rag_res = self.safety_agent.query(rag_query)
        rag_answer = rag_res.get("answer", "")
        rag_sources = rag_res.get("sources", [])

        # 2. Graph Traversal for historical precedents and connected entities
        graph_nodes = []
        graph_accidents = []
        connected_machines = []
        
        # Translate zone name to graph node ID
        zone_node_id = f"zone_{zone.lower().replace(' ', '_').replace('1', 'coke').replace('a', 'blast')}"
        # Fallback mappings
        if "coke" in zone.lower():
            zone_node_id = "zone_coke_oven"
        elif "blast" in zone.lower() or "furnace" in zone.lower():
            zone_node_id = "zone_blast_furnace"
        elif "sinter" in zone.lower():
            zone_node_id = "zone_sinter_plant"
        elif "ammonia" in zone.lower():
            zone_node_id = "zone_ammonia_tank"

        neighbors = self.risk_graph.get_neighbors(zone_node_id, direction="both")
        
        for n in neighbors:
            edge_data = n.get("edge_data", {})
            relation = edge_data.get("relation_type", "")
            
            # Find target or source details
            target_id = n.get("target_id") or n.get("source_id")
            node_info = self.risk_graph.get_node(target_id)
            if not node_info:
                continue
                
            node_type = node_info.get("node_type")
            props = node_info.get("properties", {})
            name = props.get("name", target_id)

            if node_type == "HistoricalAccident":
                graph_accidents.append({
                    "incident_id": props.get("incident_id", target_id),
                    "description": props.get("description", ""),
                    "severity": props.get("severity", "Medium"),
                    "date": props.get("date", "")
                })
            elif node_type == "Machine":
                connected_machines.append(name)
                
            graph_nodes.append(f"{node_type}: {name} (via {relation})")

        # 3. Fuse RAG text hits with Graph entities to calculate similarity scores dynamically
        # Get active telemetry and flags from risk_assessment
        telemetry = risk_assessment.get("gas_readings") or {}
        maintenance_active = risk_assessment.get("maintenance_active", False)
        shift_changeover_active = risk_assessment.get("shift_changeover_active", False)
        permits = risk_assessment.get("permits", [])
        
        # Equipment similarity based on connected machines and active permits
        equipment_sim = 40.0
        if connected_machines:
            equipment_sim = min(50.0 + len(connected_machines) * 10, 85.0)
        if any(p.get("status", "").lower() == "active" for p in permits):
            equipment_sim = max(equipment_sim, 70.0)

        # Weather similarity based on temperature and climate anomalies
        temp = telemetry.get("temperature", 25.0)
        if temp > 30.0:
            # Summer ambient temperature peak / stagnant weather match
            weather_sim = round(temp * 2.2, 1)
        else:
            weather_sim = round(30.0 + (temp * 0.4), 1)

        # Maintenance overlap similarity based on active maintenance and shift transition
        maintenance_sim = 20.0
        if maintenance_active:
            maintenance_sim = 65.0
            if shift_changeover_active:
                # High-risk maintenance-changeover overlap
                maintenance_sim = 92.0
        elif shift_changeover_active:
            maintenance_sim = 50.0

        # Root cause similarity based on telemetry threshold breaches
        co = telemetry.get("co", 0.0)
        ch4 = telemetry.get("ch4_lfl", 0.0)
        h2s = telemetry.get("h2s", 0.0)
        o2 = telemetry.get("o2", 20.9)
        
        if co > 25.0 or ch4 > 1.0 or h2s > 5.0 or o2 < 19.5 or o2 > 23.5:
            root_cause_sim = 88.0
        else:
            root_cause_sim = 35.0
        
        similar_reports = []

        # Analyze matching documents
        for src in rag_sources:
            title = src.get("title", "").lower()
            # If the title matching has the zone name or keywords, bump similarity
            item_sim = 50.0
            if zone.lower() in title:
                item_sim += 25.0
                equipment_sim = max(equipment_sim, 85.0)
            if "leak" in title or "asphyxiation" in title:
                root_cause_sim = max(root_cause_sim, 80.0)
                
            similar_reports.append({
                "title": src.get("title"),
                "source": src.get("source"),
                "similarity_score": round(item_sim + (src.get("score", 0.0) * 10.0), 1)
            })

        # Add graph accidents into similar reports
        for acc in graph_accidents:
            similar_reports.append({
                "title": f"Historical Accident {acc['incident_id']}: {acc['description']}",
                "source": "Knowledge Graph",
                "similarity_score": 88.0 if zone.lower() in acc['description'].lower() else 65.0
            })

        # Calculate a unified risk memory score (max similarity found)
        max_sim = max((item["similarity_score"] for item in similar_reports), default=0.0)
        
        # Build dynamic prevention plan recommendations
        prevention_steps = []
        if co > 25.0:
            prevention_steps.append("Initiate emergency forced exhaust ventilation to sweeps toxic CO concentration.")
        if ch4 > 1.0:
            prevention_steps.append("Revoke all active hot work permits and establish continuous flammability sweep loops.")
        if h2s > 5.0:
            prevention_steps.append("Activate specialized chemical scrubbers and mandate SCBA breathing gear.")
        if o2 < 19.5:
            prevention_steps.append("Withdraw personnel from deficient zone and activate high-flow oxygen replenishment fans.")
        
        # Permit-specific recommendations
        for p in permits:
            ptype = p.get("permit_type", "").lower()
            if "height" in ptype or "ppe" in ptype:
                prevention_steps.append("Verify personnel working at heights are continuously secured to certified anchor lines.")
            elif "confined" in ptype:
                prevention_steps.append("Station a dedicated rescue sentinel outside entry portals holding a lifeline recovery harness.")
            elif "cold" in ptype or "hot" in ptype:
                prevention_steps.append("Enforce double-valve isolation and blind-flange blocking for maintenance line segments.")
                
        if maintenance_active:
            prevention_steps.append("Verify physical padlocks and safety tags (LOTO isolation) are applied at isolation breakers.")
        if shift_changeover_active:
            prevention_steps.append("Mandate face-to-face handovers with safety supervisor override signoff verification.")

        # Default recommendations if no factors matched
        if not prevention_steps:
            prevention_steps.append("Perform routine atmospheric sweeps using calibrated portable detectors.")
            prevention_steps.append("Maintain standard safety perimeter checks and verify PPE readiness.")
            prevention_steps.append("Verify permit logging compliance before starting any localized field service.")

        prevention_plan_str = "\n".join(f"{i+1}. {step}" for i, step in enumerate(prevention_steps[:5]))

        # Build structured narrative
        narrative = (
            f"### 🧬 Hybrid RAG + Knowledge Graph Safety Precedent Analysis\n\n"
            f"Fusing vector document search with physical plant graph relations for zone **{zone}**.\n\n"
            f"**Precedent Similarity Matrix:**\n"
            f"- ⚙️ **Equipment Similarity:** {equipment_sim}% (Machines: {', '.join(connected_machines) if connected_machines else 'None'})\n"
            f"- 🌦️ **Weather Similarity:** {weather_sim}% (stagnant air dispersion / ambient heat correlation)\n"
            f"- 🔧 **Maintenance Schedule overlap:** {maintenance_sim}% (LOTO tags / SIMOPs scheduling checks)\n"
            f"- 🧠 **Root Cause Similarity:** {root_cause_sim}% (gas venting / mechanical pressure dynamics)\n\n"
            f"**Integrated Prevention Plan:**\n"
            f"{prevention_plan_str}"
        )

        return {
            "zone": zone,
            "composite_similarity": round(max_sim, 1),
            "similarity_breakdown": {
                "equipment_similarity": equipment_sim,
                "weather_similarity": weather_sim,
                "maintenance_similarity": maintenance_sim,
                "root_cause_similarity": root_cause_sim
            },
            "similar_reports": sorted(similar_reports, key=lambda x: x["similarity_score"], reverse=True),
            "connected_graph_nodes": graph_nodes,
            "fused_analysis_markdown": narrative
        }
