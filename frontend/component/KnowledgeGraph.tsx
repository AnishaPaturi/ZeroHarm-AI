"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Loader from "@/component/Loader";
import type { KGNode, KGEdge, KGNeighbor, KGReasonResponse, KGQueryResponse } from "@/types/knowledgeGraph";
import { getKnowledgeGraphSnapshot, reasonKnowledgeGraph, queryKnowledgeGraph } from "@/services/knowledgeGraph";

const NODE_TYPE_COLORS: Record<string, string> = {
  Zone: "#f87171",
  Machine: "#fb923c",
  Worker: "#facc15",
  Supervisor: "#a3e635",
  GasSensor: "#34d399",
  Permit: "#60a5fa",
  Maintenance: "#c084fc",
  HistoricalAccident: "#f472b6",
};

const NODE_TYPE_SHAPES: Record<string, string> = {
  Zone: "circle",
  Machine: "rect",
  Worker: "circle",
  Supervisor: "diamond",
  GasSensor: "triangle",
  Permit: "rect",
  Maintenance: "triangle",
  HistoricalAccident: "hexagon",
};

export default function KnowledgeGraph() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<KGNode[]>([]);
  const [edges, setEdges] = useState<KGEdge[]>([]);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedNode, setSelectedNode] = useState<KGNode | null>(null);
  const [neighbors, setNeighbors] = useState<KGNeighbor[]>([]);
  const [reasoning, setReasoning] = useState<KGReasonResponse | null>(null);
  const [queryText, setQueryText] = useState("");
  const [queryResults, setQueryResults] = useState<KGQueryResponse | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [width, setWidth] = useState(900);
  const [height, setHeight] = useState(600);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getKnowledgeGraphSnapshot();
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
    } catch (e) {
      console.error("Failed to load knowledge graph", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(Math.max(600, entry.contentRect.width || 900));
        setHeight(Math.max(400, entry.contentRect.height || 600));
      }
    });
    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  // Initialize positions in a circle, then animate with simple force layout
  useEffect(() => {
    if (nodes.length === 0) return;

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 3;

    const initial: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
    nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      initial[n.node_id] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      };
    });

    let frame = 0;
    const maxFrames = 180;

    const tick = () => {
      frame += 1;
      const pos: Record<string, { x: number; y: number }> = {};
      const damping = 0.9;
      const repulsion = 5000;
      const attraction = 0.005;
      const centerPull = 0.001;

      for (const node of nodes) {
        let fx = 0;
        let fy = 0;

        // Center pull
        fx += (cx - initial[node.node_id].x) * centerPull;
        fy += (cy - initial[node.node_id].y) * centerPull;

        // Repulsion between nodes
        for (const other of nodes) {
          if (other.node_id === node.node_id) continue;
          const dx = initial[node.node_id].x - initial[other.node_id].x;
          const dy = initial[node.node_id].y - initial[other.node_id].y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);
          const force = repulsion / distSq;
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }

        // Attraction along edges
        for (const edge of edges) {
          let otherId: string | null = null;
          if (edge.source === node.node_id) otherId = edge.target;
          else if (edge.target === node.node_id) otherId = edge.source;
          if (!otherId) continue;
          const dx = initial[otherId].x - initial[node.node_id].x;
          const dy = initial[otherId].y - initial[node.node_id].y;
          fx += dx * attraction;
          fy += dy * attraction;
        }

        initial[node.node_id].vx = (initial[node.node_id].vx + fx) * damping;
        initial[node.node_id].vy = (initial[node.node_id].vy + fy) * damping;
        initial[node.node_id].x += initial[node.node_id].vx;
        initial[node.node_id].y += initial[node.node_id].vy;

        // Clamp
        initial[node.node_id].x = Math.max(20, Math.min(width - 20, initial[node.node_id].x));
        initial[node.node_id].y = Math.max(20, Math.min(height - 20, initial[node.node_id].y));

        pos[node.node_id] = {
          x: initial[node.node_id].x,
          y: initial[node.node_id].y,
        };
      }

      setPositions(pos);

      if (frame < maxFrames) {
        requestAnimationFrame(tick);
      }
    };

    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [nodes, edges, width, height]);

  const handleNodeClick = async (node: KGNode) => {
    setSelectedNode(node);
    setReasoning(null);
    try {
      const result = await reasonKnowledgeGraph(node.node_id);
      setReasoning(result);
    } catch (e) {
      console.error("Reasoning failed", e);
    }
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim()) return;
    setQueryLoading(true);
    setQueryResults(null);
    try {
      const result = await queryKnowledgeGraph(queryText);
      setQueryResults(result);
    } catch (e) {
      console.error("Query failed", e);
    } finally {
      setQueryLoading(false);
    }
  };

  const nodeColor = (nodeType: string) => NODE_TYPE_COLORS[nodeType] || "#94a3b8";

  const renderNodeShape = (node: KGNode, x: number, y: number, size: number) => {
    const color = nodeColor(node.node_type);
    const isSelected = selectedNode?.node_id === node.node_id;
    const isHovered = hoveredNode === node.node_id;
    const stroke = isSelected ? "#fff" : isHovered ? "#fff" : "rgba(255,255,255,0.3)";
    const strokeWidth = isSelected ? 3 : isHovered ? 2 : 1;

    const shape = NODE_TYPE_SHAPES[node.node_type] || "circle";

    if (shape === "rect") {
      return (
        <rect
          x={x - size}
          y={y - size}
          width={size * 2}
          height={size * 2}
          rx={6}
          fill={color}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={0.95}
        />
      );
    }
    if (shape === "diamond") {
      return (
        <polygon
          points={`${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`}
          fill={color}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={0.95}
        />
      );
    }
    if (shape === "triangle") {
      return (
        <polygon
          points={`${x},${y - size} ${x + size},${y + size * 0.7} ${x - size},${y + size * 0.7}`}
          fill={color}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={0.95}
        />
      );
    }
    if (shape === "hexagon") {
      const pts = Array.from({ length: 6 }).map((_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        return `${x + size * Math.cos(angle)},${y + size * Math.sin(angle)}`;
      }).join(" ");
      return (
        <polygon
          points={pts}
          fill={color}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={0.95}
        />
      );
    }
    return (
      <circle
        cx={x}
        cy={y}
        r={size}
        fill={color}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={0.95}
      />
    );
  };

  const nodeRadius = (nodeType: string) => {
    if (nodeType === "Zone") return 28;
    if (nodeType === "Machine") return 22;
    if (nodeType === "HistoricalAccident") return 20;
    return 16;
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Innovation 7: Dynamic Risk Graph</h2>
          <p className="text-sm text-slate-400">
            Knowledge graph connecting workers, machines, zones, sensors, permits, supervisors, and historical accidents.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadGraph}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            Refresh Graph
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div
          ref={canvasRef}
          className="relative min-h-[420px] flex-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-950"
          style={{ width: "100%", height: Math.max(420, height) }}
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader progressStep={0} detailText="Loading knowledge graph" />
            </div>
          ) : (
            <svg width="100%" height="100%" className="block">
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const sourcePos = positions[edge.source];
                const targetPos = positions[edge.target];
                if (!sourcePos || !targetPos) return null;
                const isHighlighted = selectedNode && (edge.source === selectedNode.node_id || edge.target === selectedNode.node_id);
                return (
                  <line
                    key={`${edge.source}-${edge.target}-${edge.relation_type}`}
                    x1={sourcePos.x}
                    y1={sourcePos.y}
                    x2={targetPos.x}
                    y2={targetPos.y}
                    stroke={isHighlighted ? "#38bdf8" : "#334155"}
                    strokeWidth={isHighlighted ? 2.5 : 1.2}
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}
              {nodes.map((node) => {
                const pos = positions[node.node_id];
                if (!pos) return null;
                const size = nodeRadius(node.node_type);
                const isHovered = hoveredNode === node.node_id;
                return (
                  <g
                    key={node.node_id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onMouseEnter={() => setHoveredNode(node.node_id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => handleNodeClick(node)}
                    className="cursor-pointer"
                    style={{ opacity: selectedNode && selectedNode.node_id !== node.node_id && !hoveredNode ? 0.7 : 1 }}
                  >
                    {renderNodeShape(node, 0, 0, size)}
                    <text
                      y={size + 14}
                      textAnchor="middle"
                      fill={isHovered || selectedNode?.node_id === node.node_id ? "#fff" : "#cbd5e1"}
                      fontSize={11}
                      fontWeight={isHovered || selectedNode?.node_id === node.node_id ? 700 : 500}
                    >
                      {node.properties?.name || node.node_id}
                    </text>
                    <text y={size + 26} textAnchor="middle" fill="#94a3b8" fontSize={9}>
                      {node.node_type}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        <div className="w-full lg:w-96 space-y-4">
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Node Legend</h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
              {Object.entries(NODE_TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
                  <span>{type}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <h3 className="text-sm font-semibold text-white mb-2">AI Reasoning</h3>
            {!selectedNode ? (
              <p className="text-xs text-slate-400">Click a node to traverse the graph and generate a risk reasoning chain.</p>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-slate-300">
                  <span className="font-semibold text-white">Start:</span> {selectedNode.properties?.name || selectedNode.node_id}
                  <span className="ml-2 rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                    {selectedNode.node_type}
                  </span>
                </div>
                {reasoning ? (
                  <div className="space-y-1">
                    {reasoning.reasoning.map((line, idx) => (
                      <p key={idx} className="text-xs text-slate-300">
                        {idx + 1}. {line}
                      </p>
                    ))}
                    <div className="rounded-lg bg-slate-800 p-2 text-xs text-slate-200">
                      {reasoning.narrative}
                    </div>
                  </div>
                ) : (
                  <Loader progressStep={0} detailText="Reasoning across graph" />
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Graph Query</h3>
            <form onSubmit={handleQuery} className="flex gap-2">
              <input
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Search nodes/edges..."
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={queryLoading}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                {queryLoading ? "..." : "Go"}
              </button>
            </form>
            {queryResults && (
              <div className="mt-3 max-h-48 overflow-y-auto space-y-2 text-xs text-slate-300">
                <p className="text-slate-400">{queryResults.match_count} matches found</p>
                {queryResults.matches.map((m, idx) => (
                  <div key={idx} className="rounded-lg bg-slate-800 p-2">
                    <span className="font-semibold text-white">{m.type === "node" ? "Node" : "Edge"}: </span>
                    {m.type === "node" ? (
                      <span>{m.id} — {m.data?.node_type}</span>
                    ) : (
                      <span>
                        {m.source} -[{m.data?.relation_type}]-&gt; {m.target}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
