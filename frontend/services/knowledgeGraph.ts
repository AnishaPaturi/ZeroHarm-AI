import { fetchBackend } from "./api";
import type { KGSnapshot, KGNodeDetail, KGPathsResponse, KGReasonResponse, KGQueryResponse } from "@/types/knowledgeGraph";

const KG_BASE = "/api/knowledge-graph";

export async function getKnowledgeGraphSnapshot(): Promise<KGSnapshot> {
  return fetchBackend<KGSnapshot>(KG_BASE);
}

export async function getKnowledgeGraphNode(nodeId: string): Promise<KGNodeDetail> {
  return fetchBackend<KGNodeDetail>(`${KG_BASE}/node/${encodeURIComponent(nodeId)}`);
}

export async function getKnowledgeGraphPaths(source: string, target: string, maxLength = 4): Promise<KGPathsResponse> {
  const params = new URLSearchParams({ source, target, max_length: String(maxLength) });
  return fetchBackend<KGPathsResponse>(`${KG_BASE}/paths?${params.toString()}`);
}

export async function reasonKnowledgeGraph(nodeId: string): Promise<KGReasonResponse> {
  return fetchBackend<KGReasonResponse>(`${KG_BASE}/reason`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ node_id: nodeId }),
  });
}

export async function queryKnowledgeGraph(query: string): Promise<KGQueryResponse> {
  return fetchBackend<KGQueryResponse>(`${KG_BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
}

export async function updateKnowledgeGraphSensor(sensorNodeId: string, reading: Record<string, any>): Promise<{ status: string; sensor_node_id: string; properties: Record<string, any> }> {
  return fetchBackend(`${KG_BASE}/sensor/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sensor_node_id: sensorNodeId, reading }),
  });
}

export async function updateKnowledgeGraphZoneRisk(zoneNodeId: string, riskScore: number): Promise<{ status: string; zone_node_id: string; risk_score: number }> {
  return fetchBackend(`${KG_BASE}/zone/risk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zone_node_id: zoneNodeId, risk_score: riskScore }),
  });
}
