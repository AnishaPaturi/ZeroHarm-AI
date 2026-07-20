export interface KGNode {
  node_id: string;
  node_type: string;
  properties: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface KGEdge {
  source: string;
  target: string;
  relation_type: string;
  properties: Record<string, any>;
}

export interface KGSnapshot {
  nodes: KGNode[];
  edges: KGEdge[];
  summary: {
    node_count: number;
    edge_count: number;
  };
}

export interface KGNeighbor {
  direction: "in" | "out";
  target_id?: string;
  source_id?: string;
  edge_data: Record<string, any>;
}

export interface KGNodeDetail {
  node: KGNode;
  neighbors: KGNeighbor[];
}

export interface KGPathEdge {
  source: string;
  target: string;
  relation: string;
  properties: Record<string, any>;
}

export interface KGPath {
  nodes: string[];
  edges: KGPathEdge[];
}

export interface KGPathsResponse {
  source: string;
  target: string;
  paths: KGPath[];
  path_count: number;
}

export interface KGReasonResponse {
  start_node_id: string;
  start_node: string;
  reasoning: string[];
  narrative: string;
}

export interface KGQueryMatch {
  type: "node" | "edge";
  id?: string;
  source?: string;
  target?: string;
  data: Record<string, any>;
}

export interface KGQueryResponse {
  query: string;
  matches: KGQueryMatch[];
  match_count: number;
}

export type NodeTypeColorMap = Record<string, string>;
