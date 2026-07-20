"""
Innovation 7: Dynamic Risk Graph (Knowledge Graph)

Replaces independent database silos with a connected graph that the AI
can reason across:

    Knowledge Graph
    └─ Worker ── WorkingOn ──> Machine ── LocatedIn ──> Zone ── HasSensor ──> GasSensor
                                                          └─ HasPermit ──> Permit
                                                          └─ SupervisedBy ──> Supervisor
                                                          └─ UnderMaintenance ──> Maintenance
                                                          └─ HistoricalIncident ──> HistoricalAccident

Example reasoning:
    "Machine A connected to Valve B inside Zone C where Gas D is increasing."
    (this is far smarter than SQL joins).
"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import networkx as nx

logger = logging.getLogger("zeroharm_ai.knowledge_graph")


class KnowledgeGraphNode:
    def __init__(self, node_id: str, node_type: str, properties: Optional[Dict[str, Any]] = None):
        self.node_id = node_id
        self.node_type = node_type
        self.properties = properties or {}
        self.created_at = datetime.now().isoformat()
        self.updated_at = self.created_at

    def to_dict(self) -> Dict[str, Any]:
        return {
            "node_id": self.node_id,
            "node_type": self.node_type,
            "properties": self.properties,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class KnowledgeGraphRelation:
    def __init__(self, source_id: str, target_id: str, relation_type: str, properties: Optional[Dict[str, Any]] = None):
        self.source_id = source_id
        self.target_id = target_id
        self.relation_type = relation_type
        self.properties = properties or {}
        self.created_at = datetime.now().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_id": self.source_id,
            "target_id": self.target_id,
            "relation_type": self.relation_type,
            "properties": self.properties,
            "created_at": self.created_at,
        }


class RiskKnowledgeGraph:
    """
    In-memory directed knowledge graph modeling the full plant safety ontology.
    Supports node/link visualization, path traversal, and AI reasoning queries.
    """

    def __init__(self):
        self.graph = nx.DiGraph()
        self._seed_plant_data()

    def _seed_plant_data(self) -> None:
        """Seed the graph with default plant entities and relationships."""
        seed_nodes = [
            # Zones
            KnowledgeGraphNode("zone_coke_oven", "Zone", {"name": "Coke Oven Battery 1", "risk_score": 0.0, "status": "normal"}),
            KnowledgeGraphNode("zone_blast_furnace", "Zone", {"name": "Blast Furnace A", "risk_score": 0.0, "status": "normal"}),
            KnowledgeGraphNode("zone_sinter_plant", "Zone", {"name": "Sinter Plant", "risk_score": 0.0, "status": "normal"}),
            KnowledgeGraphNode("zone_ammonia_tank", "Zone", {"name": "Ammonia Storage Tank", "risk_score": 0.0, "status": "normal"}),

            # Machines
            KnowledgeGraphNode("machine_bf_a", "Machine", {"name": "Blast Furnace A", "status": "running"}),
            KnowledgeGraphNode("machine_valve_b", "Machine", {"name": "Valve B", "status": "running"}),
            KnowledgeGraphNode("machine_coke_oven_1", "Machine", {"name": "Coke Oven Battery 1", "status": "running"}),
            KnowledgeGraphNode("machine_compressor_c", "Machine", {"name": "Compressor C", "status": "running"}),

            # Workers
            KnowledgeGraphNode("worker_101", "Worker", {"name": "Ravi Kumar", "role": "Operator", "shift": "Morning"}),
            KnowledgeGraphNode("worker_102", "Worker", {"name": "Anil Sharma", "role": "Maintenance", "shift": "Morning"}),
            KnowledgeGraphNode("worker_103", "Worker", {"name": "Suresh Patel", "role": "Supervisor", "shift": "Morning"}),

            # Supervisors
            KnowledgeGraphNode("supervisor_suresh", "Supervisor", {"name": "Suresh Patel", "certification": "OSH-3"}),

            # Gas Sensors
            KnowledgeGraphNode("sensor_co_coke", "GasSensor", {"type": "CO", "reading_ppm": 0.0, "trend": "stable"}),
            KnowledgeGraphNode("sensor_o2_blast", "GasSensor", {"type": "O2", "reading_pct": 0.0, "trend": "stable"}),
            KnowledgeGraphNode("sensor_h2s_ammonia", "GasSensor", {"type": "H2S", "reading_ppm": 0.0, "trend": "stable"}),
            KnowledgeGraphNode("sensor_ch4_sinter", "GasSensor", {"type": "CH4", "reading_pct": 0.0, "trend": "stable"}),

            # Permits
            KnowledgeGraphNode("permit_ptw001", "Permit", {"permit_id": "PTW-2026-001", "permit_type": "hot_work", "status": "active"}),
            KnowledgeGraphNode("permit_ptw002", "Permit", {"permit_id": "PTW-2026-002", "permit_type": "confined_space", "status": "active"}),

            # Maintenance
            KnowledgeGraphNode("maintenance_m1", "Maintenance", {"type": "Preventive", "last_service": "2026-06-15", "next_due": "2026-09-15"}),
            KnowledgeGraphNode("maintenance_m2", "Maintenance", {"type": "Corrective", "last_service": "2026-07-01", "next_due": "2026-07-02"}),

            # Historical Accidents
            KnowledgeGraphNode("accident_inc1", "HistoricalAccident", {
                "incident_id": "INC-2025-089",
                "date": "2025-09-12",
                "severity": "High",
                "description": "CO leak in Coke Oven Battery 1",
            }),
            KnowledgeGraphNode("accident_inc2", "HistoricalAccident", {
                "incident_id": "INC-2024-017",
                "date": "2024-03-22",
                "severity": "Medium",
                "description": "PPE non-compliance near Blast Furnace A",
            }),
        ]

        for node in seed_nodes:
            self.graph.add_node(node.node_id, **node.to_dict())

        seed_relations = [
            # Workers -> WorkingOn -> Machine
            KnowledgeGraphRelation("worker_101", "machine_bf_a", "WorkingOn", {"started_at": "2026-07-19T08:00:00"}),
            KnowledgeGraphRelation("worker_102", "machine_valve_b", "WorkingOn", {"started_at": "2026-07-19T08:30:00"}),

            # Machines -> LocatedIn -> Zone
            KnowledgeGraphRelation("machine_bf_a", "zone_blast_furnace", "LocatedIn"),
            KnowledgeGraphRelation("machine_valve_b", "zone_blast_furnace", "LocatedIn"),
            KnowledgeGraphRelation("machine_coke_oven_1", "zone_coke_oven", "LocatedIn"),
            KnowledgeGraphRelation("machine_compressor_c", "zone_sinter_plant", "LocatedIn"),

            # Zones -> HasSensor -> GasSensor
            KnowledgeGraphRelation("zone_coke_oven", "sensor_co_coke", "HasSensor"),
            KnowledgeGraphRelation("zone_blast_furnace", "sensor_o2_blast", "HasSensor"),
            KnowledgeGraphRelation("zone_ammonia_tank", "sensor_h2s_ammonia", "HasSensor"),
            KnowledgeGraphRelation("zone_sinter_plant", "sensor_ch4_sinter", "HasSensor"),

            # Zones -> HasPermit -> Permit
            KnowledgeGraphRelation("zone_coke_oven", "permit_ptw001", "HasPermit"),
            KnowledgeGraphRelation("zone_sinter_plant", "permit_ptw002", "HasPermit"),

            # Zones -> SupervisedBy -> Supervisor
            KnowledgeGraphRelation("zone_coke_oven", "supervisor_suresh", "SupervisedBy"),
            KnowledgeGraphRelation("zone_blast_furnace", "supervisor_suresh", "SupervisedBy"),
            KnowledgeGraphRelation("zone_sinter_plant", "supervisor_suresh", "SupervisedBy"),
            KnowledgeGraphRelation("zone_ammonia_tank", "supervisor_suresh", "SupervisedBy"),

            # Zones -> UnderMaintenance -> Maintenance
            KnowledgeGraphRelation("zone_sinter_plant", "maintenance_m1", "UnderMaintenance"),
            KnowledgeGraphRelation("zone_blast_furnace", "maintenance_m2", "UnderMaintenance"),

            # Zones -> HistoricalIncident -> HistoricalAccident
            KnowledgeGraphRelation("zone_coke_oven", "accident_inc1", "HistoricalIncident"),
            KnowledgeGraphRelation("zone_blast_furnace", "accident_inc2", "HistoricalIncident"),

            # Machine -> connected_to -> Machine (valve-piping style connections)
            KnowledgeGraphRelation("machine_bf_a", "machine_valve_b", "ConnectedTo", {"description": "Main outlet valve"}),


        ]

        for rel in seed_relations:
            self.graph.add_edge(
                rel.source_id, rel.target_id,
                relation_type=rel.relation_type,
                properties=rel.properties,
                created_at=rel.created_at,
            )

        logger.info(f"Knowledge Graph seeded with {self.graph.number_of_nodes()} nodes and {self.graph.number_of_edges()} edges.")

    def add_node(self, node: KnowledgeGraphNode) -> Dict[str, Any]:
        self.graph.add_node(node.node_id, **node.to_dict())
        return {"status": "success", "node_id": node.node_id}

    def add_relation(self, rel: KnowledgeGraphRelation) -> Dict[str, Any]:
        self.graph.add_edge(
            rel.source_id, rel.target_id,
            relation_type=rel.relation_type,
            properties=rel.properties,
            created_at=rel.created_at,
        )
        return {"status": "success", "source_id": rel.source_id, "target_id": rel.target_id}

    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        if node_id not in self.graph.nodes:
            return None
        return dict(self.graph.nodes[node_id])

    def get_neighbors(self, node_id: str, direction: str = "both") -> List[Dict[str, Any]]:
        if node_id not in self.graph.nodes:
            return []

        result = []
        if direction in ("both", "out"):
            for _, target, data in self.graph.out_edges(node_id, data=True):
                result.append({"direction": "out", "target_id": target, "edge_data": data})
        if direction in ("both", "in"):
            for source, _, data in self.graph.in_edges(node_id, data=True):
                result.append({"direction": "in", "source_id": source, "edge_data": data})
        return result

    def find_paths(self, source_id: str, target_id: str, max_length: int = 4) -> List[List[Dict[str, Any]]]:
        if source_id not in self.graph.nodes or target_id not in self.graph.nodes:
            return []
        try:
            simple_paths = list(nx.all_simple_paths(self.graph, source_id, target_id, cutoff=max_length))
        except nx.NodeNotFound:
            return []

        paths = []
        for path in simple_paths:
            edges_info = []
            for i in range(len(path) - 1):
                edge_data = self.graph.get_edge_data(path[i], path[i + 1])
                edges_info.append({
                    "source": path[i],
                    "target": path[i + 1],
                    "relation": edge_data.get("relation_type"),
                    "properties": edge_data.get("properties"),
                })
            paths.append({"nodes": path, "edges": edges_info})
        return paths

    def reason_across_graph(self, start_node_id: str) -> Dict[str, Any]:
        """
        AI-style reasoning traversal: from a starting node, walk the graph
        and produce a human-readable chain that explains compound risk.
        Example output for start_node_id=machine_valve_b:
          "Machine A connected to Valve B inside Zone C where Gas D is increasing."
        """
        if start_node_id not in self.graph.nodes:
            return {"error": f"Node '{start_node_id}' not found"}

        sentences: List[str] = []
        visited = set()
        current_node = start_node_id
        visited.add(current_node)

        node_data = self.get_node(current_node) or {}
        node_type = node_data.get("node_type", current_node)
        node_name = node_data.get("properties", {}).get("name", current_node)

        def _describe(node_id: str) -> str:
            nd = self.get_node(node_id) or {}
            ntype = nd.get("node_type", node_id)
            props = nd.get("properties", {})
            name = props.get("name", props.get("permit_id", node_id))
            return f"{ntype} '{name}' ({node_id})"

        # Walk outgoing edges up to depth 3
        def walk(node_id: str, depth: int = 0):
            if depth >= 3:
                return
            for _, target, edge_data in self.graph.out_edges(node_id, data=True):
                if target in visited:
                    continue
                visited.add(target)
                relation = edge_data.get("relation_type", "connected to")
                target_data = self.get_node(target) or {}
                props = target_data.get("properties", {})

                if relation == "LocatedIn":
                    sentences.append(f"{_describe(node_id)} is inside {_describe(target)}")
                elif relation == "HasSensor":
                    sensor_type = props.get("type", "unknown")
                    reading = props.get("reading_ppm", props.get("reading_pct", "N/A"))
                    trend = props.get("trend", "stable")
                    sentences.append(
                        f"{_describe(target)} reports {sensor_type}={reading} ({trend})"
                    )
                elif relation == "HasPermit":
                    ptype = props.get("permit_type", "unknown")
                    status = props.get("status", "unknown")
                    sentences.append(
                        f"{_describe(target)} is active (type={ptype}, status={status})"
                    )
                elif relation == "ConnectedTo":
                    sentences.append(f"{_describe(node_id)} is connected to {_describe(target)}")
                elif relation == "WorkingOn":
                    sentences.append(f"{_describe(target)} is working on {_describe(node_id)}")
                elif relation == "UnderMaintenance":
                    mtype = props.get("type", "unknown")
                    sentences.append(f"{_describe(target)} is under {mtype} maintenance")
                elif relation == "HistoricalIncident":
                    sev = props.get("severity", "unknown")
                    desc = props.get("description", "")
                    sentences.append(
                        f"{_describe(target)} previously recorded here (severity={sev}: {desc})"
                    )
                elif relation == "SupervisedBy":
                    sentences.append(f"{_describe(target)} supervises this zone")
                else:
                    sentences.append(f"{_describe(node_id)} {relation} {_describe(target)}")

                # Recurse
                walk(target, depth + 1)

        walk(start_node_id)
        return {
            "start_node_id": start_node_id,
            "start_node": _describe(start_node_id),
            "reasoning": sentences,
            "narrative": ". ".join(sentences) + "." if sentences else "No connected nodes found.",
        }

    def snapshot(self) -> Dict[str, Any]:
        nodes = []
        for nid in self.graph.nodes:
            nd = dict(self.graph.nodes[nid])
            nd["node_id"] = nid
            nodes.append(nd)

        edges = []
        for u, v, d in self.graph.edges(data=True):
            edges.append({
                "source": u,
                "target": v,
                "relation_type": d.get("relation_type"),
                "properties": d.get("properties"),
            })

        return {
            "nodes": nodes,
            "edges": edges,
            "summary": {
                "node_count": self.graph.number_of_nodes(),
                "edge_count": self.graph.number_of_edges(),
            },
        }

    def query(self, query: str) -> Dict[str, Any]:
        """
        Simple keyword query across nodes and relations.
        Returns matching nodes and any connected paths.
        """
        q = query.lower().strip()
        matches = []

        for nid in self.graph.nodes:
            nd = self.graph.nodes[nid]
            node_str = f"{nid} {nd.get('node_type', '')} {nd.get('properties', {})}".lower()
            if q in node_str:
                matches.append({"type": "node", "id": nid, "data": dict(nd)})

        for u, v, d in self.graph.edges(data=True):
            edge_str = f"{d.get('relation_type', '')} {d.get('properties', {})}".lower()
            if q in edge_str:
                matches.append({"type": "edge", "source": u, "target": v, "data": d})

        return {
            "query": query,
            "matches": matches[:50],
            "match_count": len(matches),
        }

    def update_sensor_reading(self, sensor_node_id: str, reading: Dict[str, Any]) -> Dict[str, Any]:
        if sensor_node_id not in self.graph.nodes:
            return {"error": f"Sensor node '{sensor_node_id}' not found"}
        self.graph.nodes[sensor_node_id]["properties"].update(reading)
        self.graph.nodes[sensor_node_id]["updated_at"] = datetime.now().isoformat()
        return {"status": "updated", "sensor_node_id": sensor_node_id, "properties": self.graph.nodes[sensor_node_id]["properties"]}

    def update_zone_risk(self, zone_node_id: str, risk_score: float) -> Dict[str, Any]:
        if zone_node_id not in self.graph.nodes:
            return {"error": f"Zone node '{zone_node_id}' not found"}
        self.graph.nodes[zone_node_id]["properties"]["risk_score"] = risk_score
        self.graph.nodes[zone_node_id]["properties"]["status"] = "critical" if risk_score >= 75 else "warning" if risk_score >= 40 else "normal"
        self.graph.nodes[zone_node_id]["updated_at"] = datetime.now().isoformat()
        return {"status": "updated", "zone_node_id": zone_node_id, "risk_score": risk_score}
