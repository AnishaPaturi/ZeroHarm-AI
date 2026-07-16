import networkx as nx
from typing import Dict, Any, List

class PlantTopology:
    """
    Person D / Plant Adjacency Architecture:
    In-memory directed process topology graph using networkx.
    Models physical connections (pipelines, steam feeds, fuel grids)
    between zones to calculate cascading risk scores from upstream failures.
    """
    def __init__(self):
        self.graph = nx.DiGraph()
        self._initialize_topology()

    def _initialize_topology(self):
        # Nodes represent plant zones.
        # Edges represent directed piping, venting, or electricity grid connections.
        # propagation_factor: fraction of upstream risk that leaks/transmits downstream (0.0 - 1.0)
        
        # 1. Blast Furnace A -> Coke Oven Battery 1
        # Blast Furnace gas is piped to coke ovens to supply heating gas.
        self.graph.add_edge(
            "Blast Furnace A", "Coke Oven Battery 1",
            connection_type="Blast Furnace Gas line (BFG)",
            propagation_factor=0.40,
            description="Upstream gas main feeding Blast Furnace recovery gas for underfiring heat."
        )

        # 2. Coke Oven Battery 1 -> Sinter Plant
        # Coke oven gas is cleaned and fed to Sinter Plant ignition hood.
        self.graph.add_edge(
            "Coke Oven Battery 1", "Sinter Plant",
            connection_type="Coke Byproduct Gas line (COG)",
            propagation_factor=0.35,
            description="Coke oven gas supplied as ignition fuel to sinter plant furnace burners."
        )

        # 3. Coke Oven Battery 1 -> Ammonia Storage Tank
        # Liquid ammonia recovered from coke oven gas is piped to Ammonia Storage.
        self.graph.add_edge(
            "Coke Oven Battery 1", "Ammonia Storage Tank",
            connection_type="Ammonia Liquid Recovery line",
            propagation_factor=0.30,
            description="Chemical byproduct recovery pipeline transferring anhydrous ammonia."
        )

    def get_cascading_risks(self, active_risks: Dict[str, float]) -> Dict[str, Dict[str, Any]]:
        """
        Computes the process-level cascading risk propagated to each zone based on active risks.
        
        active_risks: dict mapping zone name to its local composite risk score.
        Returns:
            dict of zone_name -> {
                "propagated_score": float, # Max propagated risk value
                "sources": List[dict]      # List of contributing upstream hazards
            }
        """
        cascades: Dict[str, Dict[str, Any]] = {
            node: {"propagated_score": 0.0, "sources": []}
            for node in self.graph.nodes
        }

        for source_zone, risk_score in active_risks.items():
            # Only propagate risks above a low baseline (e.g. score > 20)
            if risk_score <= 20.0 or source_zone not in self.graph:
                continue

            # Find all direct downstream connections (successors)
            for successor in self.graph.successors(source_zone):
                edge_data = self.graph.get_edge_data(source_zone, successor)
                factor = edge_data.get("propagation_factor", 0.1)
                
                # Propagated risk = Source Risk * Propagation Factor
                propagated_val = round(risk_score * factor, 1)
                
                if propagated_val > 0:
                    cascades[successor]["sources"].append({
                        "source_zone": source_zone,
                        "connection": edge_data.get("connection_type"),
                        "source_risk": risk_score,
                        "propagated_risk": propagated_val,
                        "description": edge_data.get("description")
                    })
                    
                    # Store the highest propagated risk among multiple upstream sources
                    cascades[successor]["propagated_score"] = max(
                        cascades[successor]["propagated_score"],
                        propagated_val
                    )

        return cascades
