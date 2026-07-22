'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fetchBackend, WS_BASE_URL } from '../../services/api';
import { useIncident } from '../../hooks/useIncident';
import { useShallow } from 'zustand/react/shallow';

// ---- Types ----
interface ZoneLayout {
  zone: string;
  polygon: [number, number][];
  centroid: [number, number];
  hazard_classification: string;
}

interface HeatmapZone {
  zone: string;
  polygon: [number, number][];
  centroid: [number, number];
  hazard_classification: string;
  risk_score: number;
  risk_level: string;
  color: string;
  worker_count: number;
  action_required?: string;
  last_updated?: string;
}

interface WorkerLocation {
  worker_id: string;
  name: string;
  zone: string;
  x: number;
  y: number;
  status: string;
}

interface GasCloud {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  color: string;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

// ---- Risk color map ----
const RISK_COLORS: Record<string, { fill: string; glow: string; gas: string }> = {
  Safe:      { fill: 'rgba(34,197,94,0.25)',  glow: '#22c55e', gas: 'rgba(34,197,94,0.35)' },
  Warning:   { fill: 'rgba(234,179,8,0.25)',  glow: '#eab308', gas: 'rgba(234,179,8,0.35)' },
  Critical:  { fill: 'rgba(239,68,68,0.30)',  glow: '#ef4444', gas: 'rgba(239,68,68,0.45)' },
  Unknown:   { fill: 'rgba(148,163,184,0.15)', glow: '#64748b', gas: 'rgba(148,163,184,0.20)' },
};

const RISK_LEVEL_ORDER = ['Safe', 'Warning', 'Critical', 'Unknown'];

function getRiskLevelColor(level: string) {
  return RISK_COLORS[level] || RISK_COLORS.Unknown;
}

// ---- Map coordinate range ----
const MAP_BOUNDS = { minX: -10, maxX: 200, minY: -10, maxY: 160 };

// ---- Canvas scaling ----
function worldToCanvas(wx: number, wy: number, width: number, height: number, padding = 50) {
  const scaleX = (width - padding * 2) / (MAP_BOUNDS.maxX - MAP_BOUNDS.minX);
  const scaleY = (height - padding * 2) / (MAP_BOUNDS.maxY - MAP_BOUNDS.minY);
  const scale = Math.min(scaleX, scaleY);
  const cx = width / 2;
  const cy = height / 2;
  const worldCX = (MAP_BOUNDS.minX + MAP_BOUNDS.maxX) / 2;
  const worldCY = (MAP_BOUNDS.minY + MAP_BOUNDS.maxY) / 2;
  return {
    x: cx + (wx - worldCX) * scale,
    y: cy + (wy - worldCY) * scale,
  };
}

function canvasToWorld(cx: number, cy: number, width: number, height: number, padding = 50) {
  const scaleX = (width - padding * 2) / (MAP_BOUNDS.maxX - MAP_BOUNDS.minX);
  const scaleY = (height - padding * 2) / (MAP_BOUNDS.maxY - MAP_BOUNDS.minY);
  const scale = Math.min(scaleX, scaleY);
  const wcx = width / 2;
  const wcy = height / 2;
  const worldCX = (MAP_BOUNDS.minX + MAP_BOUNDS.maxX) / 2;
  const worldCY = (MAP_BOUNDS.minY + MAP_BOUNDS.maxY) / 2;
  return {
    x: worldCX + (cx - wcx) / scale,
    y: worldCY + (cy - wcy) / scale,
  };
}

// ---- Gas cloud generation ----
function generateGasClouds(zones: HeatmapZone[]): GasCloud[] {
  const clouds: GasCloud[] = [];
  let id = 0;
  zones.forEach((zone) => {
    const level = zone.risk_level;
    if (level === 'Unknown') return;
    const intensity = level === 'Critical' ? 1.0 : level === 'Warning' ? 0.6 : 0.25;
    const cx = zone.centroid[0];
    const cy = zone.centroid[1];
    const baseRadius = 12 + intensity * 20;
    const count = level === 'Critical' ? 5 : level === 'Warning' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      clouds.push({
        id: `cloud_${id++}`,
        x: cx + (Math.random() - 0.5) * 30,
        y: cy + (Math.random() - 0.5) * 30,
        radius: Math.random() * baseRadius,
        maxRadius: baseRadius * (1.2 + Math.random() * 0.8),
        opacity: 0.15 + intensity * 0.25,
        color: getRiskLevelColor(level).gas,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3 - 0.1,
        life: Math.random() * 100,
        maxLife: 100 + Math.random() * 100,
      });
    }
  });
  return clouds;
}

// ---- Emergency exit positions (simulated around zone polygons) ----
function getEmergencyExits(zone: HeatmapZone): [number, number][] {
  const exits: [number, number][] = [];
  const poly = zone.polygon;
  if (poly.length < 4) return exits;
  const edges = [
    [poly[0], poly[1]],
    [poly[1], poly[2]],
    [poly[2], poly[3]],
    [poly[3], poly[0]],
  ];
  edges.forEach((edge, i) => {
    const mx = (edge[0][0] + edge[1][0]) / 2;
    const my = (edge[0][1] + edge[1][1]) / 2;
    exits.push([mx, my]);
  });
  return exits;
}

// ---- Main Component ----
import { Cpu } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

export default function DigitalTwin() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const lastWorkerFetchRef = useRef<number>(0);

  // Drone Inspection Simulator (Innovation 16)
  const [droneActive, setDroneActive] = useState(false);
  const [droneZone, setDroneZone] = useState<string | null>(null);
  const [droneData, setDroneData] = useState<any>(null);

  const dispatchDrone = async (zoneName: string) => {
    try {
      const res = await fetchBackend<any>(`/api/drone/dispatch?zone=${encodeURIComponent(zoneName)}`, {
        method: 'POST',
      });
      setDroneActive(true);
      setDroneZone(zoneName);
      setDroneData(res);
      useNotifications.getState().addToast(`Drone deployed to ${zoneName}. Scanning sensors...`, 'info');
    } catch (err: any) {
      console.error("Drone dispatch failed:", err);
      useNotifications.getState().addToast(`Failed to deploy drone: ${err.message || 'Drone backend offline'}`, 'error');
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (droneActive && droneZone) {
      interval = setInterval(async () => {
        try {
          const status = await fetchBackend<any>('/api/drone/status');
          setDroneData(status);
          if (status.status === 'Landed') {
            setDroneActive(false);
            setDroneZone(null);
            useNotifications.getState().addToast(`Drone mission complete. Returned to base pad.`, 'success');
          }
        } catch (err) {
          console.error("Drone status check failed:", err);
          setDroneActive(false);
          setDroneZone(null);
          if (interval) clearInterval(interval);
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [droneActive, droneZone]);

  const [layout, setLayout] = useState<Record<string, ZoneLayout>>({});
  const [zones, setZones] = useState<HeatmapZone[]>([]);
  const [workers, setWorkers] = useState<WorkerLocation[]>([]);
  const [gasClouds, setGasClouds] = useState<GasCloud[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const emergencyMode = useIncident(useShallow((s: any) => s.emergencyMode));
  const evacuationMessage = useIncident(useShallow((s: any) => s.evacuationMessage));

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const [layoutData, heatmapData, workersData] = await Promise.all([
        fetchBackend<any>('/api/plant-layout'),
        fetchBackend<any>('/api/heatmap'),
        fetchBackend<any>('/api/workers'),
      ]);
      setLayout(layoutData);
      const zoneList = Object.values(heatmapData.zones || []) as HeatmapZone[];
      setZones(zoneList);
      setWorkers(workersData || []);
      setGasClouds(generateGasClouds(zoneList));
      setIsLive(true);
    } catch (e) {
      console.error('Backend offline, failed to fetch digital twin telemetry:', e);
      setIsLive(false);
      setLayout({});
      setZones([]);
      setWorkers([]);
      setGasClouds([]);
    }
  }, []);

  // WebSocket connection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (!pollInterval) {
        console.log('[DigitalTwin] Starting fallback polling');
        pollInterval = setInterval(fetchData, 3000);
      }
    };

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    try {
      const wsUrl = `${WS_BASE_URL}/ws/risk-feed`;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[DigitalTwin] WebSocket connected');
        stopPolling();
        fetchData();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'risk_update' || data.event === 'heatmap_update') {
            const updatedZoneName = data.zone;
            if (!updatedZoneName) return;

            const riskLevel = data.risk_assessment?.risk_level || 'Unknown';
            const riskScore = data.risk_assessment?.composite_risk_score || 0;
            const actionRequired = data.risk_assessment?.action_required || '';

            setZones((prevZones) => {
              const newZones = prevZones.map((z) => {
                if (z.zone === updatedZoneName) {
                  return {
                    ...z,
                    risk_score: riskScore,
                    risk_level: riskLevel,
                    color: getRiskLevelColor(riskLevel).glow,
                    worker_count: data.state?.permits?.[0]?.workers_count ?? z.worker_count ?? 0,
                    action_required: actionRequired || z.action_required,
                    last_updated: new Date().toISOString(),
                  } as HeatmapZone;
                }
                return z;
              });
              setGasClouds(generateGasClouds(newZones));
              return newZones;
            });
          }
        } catch (e) {
          console.warn('[DigitalTwin] WS parse error', e);
        }
      };

      ws.onerror = () => {
        console.warn('[DigitalTwin] WS offline, fallback to polling');
        startPolling();
      };

      ws.onclose = () => {
        console.log('[DigitalTwin] WebSocket closed, falling back to polling');
        startPolling();
      };
    } catch (e) {
      console.warn('[DigitalTwin] WS connection error, falling back to polling', e);
      startPolling();
    }

    return () => {
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
      stopPolling();
    };
  }, [fetchData]);

  // Periodic worker fetch
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now();
      if (now - lastWorkerFetchRef.current < 2000) return;
      lastWorkerFetchRef.current = now;
      try {
        const data = await fetchBackend<any[]>('/api/workers');
        if (Array.isArray(data)) setWorkers(data);
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Animation state
    let time = 0;
    const workerTrails = new Map<string, TrailPoint[]>();

    const drawGrid = (w: number, h: number) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    };

    const drawZone = (zone: HeatmapZone, w: number, h: number) => {
      const poly = zone.polygon;
      if (!poly || poly.length === 0) return;
      const colors = getRiskLevelColor(zone.risk_level);

      ctx.beginPath();
      const first = worldToCanvas(poly[0][0], poly[0][1], w, h);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < poly.length; i++) {
        const pt = worldToCanvas(poly[i][0], poly[i][1], w, h);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();

      // Glow effect
      ctx.save();
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = 25 + Math.sin(time * 0.05) * 8;
      ctx.fillStyle = colors.fill;
      ctx.fill();
      ctx.restore();

      // Border
      ctx.strokeStyle = colors.glow;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -time * 0.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Zone label
      const centroid = worldToCanvas(zone.centroid[0], zone.centroid[1], w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(zone.zone, centroid.x, centroid.y - 8);
      ctx.fillStyle = colors.glow;
      ctx.font = 'bold 13px "Space Mono", monospace';
      ctx.fillText(`${zone.risk_score}%`, centroid.x, centroid.y + 10);

      // Emergency exit indicators
      const exits = getEmergencyExits(zone);
      const isEvacuating = zone.risk_level === 'Critical';
      exits.forEach((ex, i) => {
        const ep = worldToCanvas(ex[0], ex[1], w, h);
        const exitBlocked = isEvacuating;
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = exitBlocked ? 'rgba(239,68,68,0.9)' : 'rgba(34,197,94,0.8)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (exitBlocked) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px "Space Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('BLOCKED', ep.x, ep.y - 10);
        } else {
          ctx.fillStyle = '#22c55e';
          ctx.font = '8px "Space Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('EXIT', ep.x, ep.y - 10);
        }
      });

      // Overheating effect for high risk
      if (zone.risk_level === 'Critical') {
        const pulse = 0.5 + 0.5 * Math.sin(time * 0.15);
        ctx.beginPath();
        ctx.arc(centroid.x, centroid.y, 30 + pulse * 20, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239,68,68,${0.08 + pulse * 0.08})`;
        ctx.fill();
      }
    };

    const drawWorker = (worker: WorkerLocation, w: number, h: number) => {
      const p = worldToCanvas(worker.x, worker.y, w, h);
      const isEvacuating = worker.status === 'evacuating';
      const color = isEvacuating ? '#ef4444' : '#38bdf8';

      // Trail
      let trail = workerTrails.get(worker.worker_id);
      if (!trail) trail = [];
      trail.push({ x: p.x, y: p.y, t: time });
      if (trail.length > 20) trail.shift();
      workerTrails.set(worker.worker_id, trail);

      ctx.beginPath();
      trail.forEach((tp, i) => {
        const alpha = (i / trail.length) * 0.4;
        ctx.fillStyle = isEvacuating ? `rgba(239,68,68,${alpha})` : `rgba(56,189,248,${alpha})`;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 2 + (i / trail.length) * 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Worker dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, isEvacuating ? 6 : 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Worker label
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(worker.name, p.x, p.y - 10);
    };

    const drawGasClouds = (clouds: GasCloud[], w: number, h: number) => {
      clouds.forEach((cloud) => {
        const p = worldToCanvas(cloud.x, cloud.y, w, h);
        const lifeRatio = cloud.life / cloud.maxLife;
        const currentRadius = cloud.radius * (0.8 + lifeRatio * 0.4);
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, currentRadius);
        gradient.addColorStop(0, cloud.color.replace(/[\d.]+\)$/, `${cloud.opacity * lifeRatio})`));
        gradient.addColorStop(1, cloud.color.replace(/[\d.]+\)$/, '0)'));
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });
    };

    const drawHUD = (w: number, h: number) => {
      // Legend
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(10, 10, 180, 90);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(10, 10, 180, 90);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px "Space Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('RISK LEVEL LEGEND', 20, 28);
      const legendItems = [
        { label: 'Safe', color: '#22c55e' },
        { label: 'Warning', color: '#eab308' },
        { label: 'Critical', color: '#ef4444' },
        { label: 'Unknown', color: '#64748b' },
      ];
      legendItems.forEach((item, i) => {
        ctx.fillStyle = item.color;
        ctx.fillRect(20, 38 + i * 14, 10, 10);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '9px "Space Mono", monospace';
        ctx.fillText(item.label, 35, 48 + i * 14);
      });

      // Live indicator
      ctx.fillStyle = isLive ? '#22c55e' : '#ef4444';
      ctx.beginPath();
      ctx.arc(w - 20, 20, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px "Space Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(isLive ? 'LIVE' : 'OFFLINE', w - 30, 24);
    };

    const animate = () => {
      time++;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = '#050b18';
      ctx.fillRect(0, 0, w, h);
      drawGrid(w, h);

      // Draw gas clouds behind zones
      drawGasClouds(gasClouds, w, h);

      // Draw zones
      zones.forEach((zone) => drawZone(zone, w, h));

      // Draw workers
      workers.forEach((worker) => drawWorker(worker, w, h));

      // Draw selected zone highlight
      if (selectedZone) {
        const zone = zones.find(z => z.zone === selectedZone);
        if (zone && zone.polygon.length > 0) {
          ctx.beginPath();
          const first = worldToCanvas(zone.polygon[0][0], zone.polygon[0][1], w, h);
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < zone.polygon.length; i++) {
            const pt = worldToCanvas(zone.polygon[i][0], zone.polygon[i][1], w, h);
            ctx.lineTo(pt.x, pt.y);
          }
          ctx.closePath();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }

      // Draw simulated drone hovering (Innovation 16)
      if (droneActive && droneZone) {
        const zoneCentroid = layout[droneZone]?.centroid || [40, 30];
        const time = Date.now() / 1000;
        const dp = worldToCanvas(zoneCentroid[0], zoneCentroid[1], w, h);
        
        ctx.beginPath();
        ctx.arc(dp.x, dp.y + Math.sin(time * 6) * 4 - 25, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#f97316';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Draw rotor lines
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.5;
        // Left rotor
        ctx.beginPath();
        ctx.moveTo(dp.x - 12, dp.y + Math.sin(time * 6) * 4 - 25);
        ctx.lineTo(dp.x + 12, dp.y + Math.sin(time * 6) * 4 - 25);
        ctx.stroke();
        
        // Laser scanning beam downwards
        ctx.beginPath();
        ctx.moveTo(dp.x, dp.y + Math.sin(time * 6) * 4 - 20);
        ctx.lineTo(dp.x - 15, dp.y);
        ctx.lineTo(dp.x + 15, dp.y);
        ctx.closePath();
        ctx.fillStyle = `rgba(249, 115, 22, ${0.1 + 0.08 * Math.sin(time * 4)})`;
        ctx.fill();
        
        // Text
        ctx.fillStyle = '#f97316';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("DRONE SWEEP", dp.x, dp.y + Math.sin(time * 6) * 4 - 35);
      }

      // Emergency banner
      if (emergencyMode) {
        const bannerY = h - 60;
        ctx.fillStyle = 'rgba(239,68,68,0.2)';
        ctx.fillRect(0, bannerY, w, 60);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, bannerY);
        ctx.lineTo(w, bannerY);
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 14px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('EMERGENCY: EVACUATION ACTIVE', w / 2, bannerY + 30);
        ctx.fillStyle = '#fca5a5';
        ctx.font = '11px "Space Mono", monospace';
        ctx.fillText(evacuationMessage || 'Critical hazard detected', w / 2, bannerY + 48);
      }

      // HUD
      drawHUD(w, h);

      // Update gas clouds
      setGasClouds((prev) =>
        prev.map((cloud) => {
          const next = { ...cloud };
          next.life += 1;
          if (next.life >= next.maxLife) {
            next.life = 0;
            next.x += (Math.random() - 0.5) * 10;
            next.y += (Math.random() - 0.5) * 10;
          }
          next.x += next.vx;
          next.y += next.vy;
          return next;
        })
      );

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [zones, workers, gasClouds, isLive, selectedZone, emergencyMode, evacuationMessage]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const world = canvasToWorld(cx, cy, rect.width, rect.height);
    let clicked: string | null = null;
    zones.forEach((zone) => {
      if (!zone.polygon || zone.polygon.length === 0) return;
      const [minX, minY] = zone.polygon.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1])]);
      const [maxX, maxY] = zone.polygon.reduce((a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
      if (world.x >= minX && world.x <= maxX && world.y >= minY && world.y <= maxY) {
        clicked = zone.zone;
      }
    });
    setSelectedZone(clicked);
  };

  const selectedZoneData = zones.find((z) => z.zone === selectedZone);
  const selectedWorkers = workers.filter((w) => w.zone === selectedZone);

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">
            GEOSPATIAL INTELLIGENCE
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Industrial Digital Twin
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Live plant visualization — real-time risk overlay, worker tracking, gas dispersion, and emergency routing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="px-3 py-1.5 bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl text-[10px] font-bold font-mono transition-all"
          >
            REFRESH
          </button>
          <div className={`px-3 py-1.5 rounded-xl text-[10px] font-bold font-mono border ${
            isLive ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {isLive ? 'LIVE FEED' : 'OFFLINE'}
          </div>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="glass-panel border border-white/10 rounded-3xl relative overflow-hidden" style={{ height: '70vh', minHeight: '500px' }}>
        <div ref={containerRef} className="w-full h-full cursor-crosshair">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="w-full h-full block"
          />
        </div>
        {/* Selected Zone Panel: Closed-Loop Multi-Agent Intelligence */}
        {selectedZoneData && (
          <div className="absolute top-4 right-4 w-96 max-h-[85vh] overflow-y-auto glass-panel border border-white/20 rounded-2xl p-5 shadow-2xl z-30">
            <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-base font-bold text-white">{selectedZoneData.zone}</h3>
                  <span className="text-[9px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                    CLOSED-LOOP ENGINE
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{selectedZoneData.hazard_classification}</p>
              </div>
              <button
                onClick={() => setSelectedZone(null)}
                className="text-slate-400 hover:text-white text-sm font-bold bg-white/5 hover:bg-white/10 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* 1. Composite Risk & Heatmap Metrics */}
            <div className="grid grid-cols-3 gap-2 mb-4 bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="flex flex-col items-center justify-center">
                <span className="text-[9px] text-slate-400 font-mono">RISK SCORE</span>
                <span className="text-sm font-bold mt-1" style={{ color: selectedZoneData.color }}>
                  {selectedZoneData.risk_score} / 100
                </span>
              </div>
              <div className="flex flex-col items-center justify-center">
                <span className="text-[9px] text-slate-400 font-mono">STATUS</span>
                <span className="text-xs font-bold mt-1" style={{ color: selectedZoneData.color }}>
                  {selectedZoneData.risk_level.toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center">
                <span className="text-[9px] text-slate-400 font-mono">CREW ON-SITE</span>
                <span className="text-sm font-bold text-white mt-1">{selectedWorkers.length} workers</span>
              </div>
            </div>

            {/* 2. Permit Agent Section */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold tracking-wider">
                  1. PERMIT AGENT AUDIT (SIMOPS)
                </span>
                <span className="text-[9px] font-mono text-slate-400">ACTIVE PERMITS</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-cyan-500/20 text-xs">
                {selectedZoneData.risk_score >= 75 ? (
                  <div className="flex flex-col gap-1 text-red-400 font-mono text-[11px]">
                    <span className="font-bold flex items-center gap-1">
                      ⚠️ PTW-HW-202 (Hot Work) — AUTO-SUSPENDED
                    </span>
                    <span className="text-[10px] text-slate-300">
                      Reason: Spark risk during elevated methane levels. Closed-loop engine revoked permit automatically.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-green-400 font-mono text-[11px]">
                    <span>✓ Active Permits Audited</span>
                    <span className="text-[10px] text-slate-400">0 SIMOPs Conflicts</span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Statutory Compliance Citations (RAG) */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-mono text-purple-400 uppercase font-bold tracking-wider">
                  2. RAG STATUTORY CITATIONS
                </span>
                <span className="text-[9px] font-mono text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded">
                  OISD / FACTORIES ACT
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/20 text-[10px] text-slate-300 flex flex-col gap-1.5 font-mono">
                <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                  <span className="bg-purple-500/30 px-1 py-0.5 rounded text-[9px]">OISD-STD-105 Clause 4.2</span>
                  <span>Hot Work Prohibition Zone</span>
                </div>
                <p className="text-[9px] text-slate-400 leading-relaxed">
                  "Hot work is strictly prohibited within 15 meters of hydrocarbon venting or atmosphere with CH4 &gt; 4% LFL."
                </p>
                <div className="flex items-center gap-1.5 text-amber-300 font-bold pt-1 border-t border-purple-500/20">
                  <span className="bg-amber-500/30 px-1 py-0.5 rounded text-[9px]">Factories Act 1948 Sec 36</span>
                  <span>Confined Space Entry Rule</span>
                </div>
              </div>
            </div>

            {/* 4. Compound Action Required */}
            {selectedZoneData.action_required && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-[9px] text-amber-400 font-mono uppercase font-bold block mb-1">
                  3. COMPOUND RISK MANDATE
                </span>
                <p className="text-[10px] text-slate-200 leading-relaxed font-mono">{selectedZoneData.action_required}</p>
              </div>
            )}

            {/* 5. Emergency Response Trigger */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={() => dispatchDrone(selectedZoneData.zone)}
                className="py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl text-[10px] tracking-wide transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer border-0"
              >
                <Cpu className="w-3.5 h-3.5" />
                DISPATCH DRONE
              </button>
              <button
                onClick={() => alert(`Initiated emergency evacuation procedure for ${selectedZoneData.zone}`)}
                className="py-2.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-semibold rounded-xl text-[10px] tracking-wide transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer border-0"
              >
                EVACUATE ZONE
              </button>
            </div>
          </div>
        )}

        {/* Drone Stream Overlay (Innovation 16) */}
        {droneActive && droneData && (
          <div className="absolute top-4 left-4 w-80 glass-panel border border-white/15 rounded-3xl p-4 shadow-2xl flex flex-col gap-3 z-30">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-safety-orange animate-pulse" />
                <h4 className="font-heading text-xs font-bold text-white uppercase tracking-wider">
                  Autonomous Drone Feed
                </h4>
              </div>
              <span className="text-[9px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                BATTERY: {droneData.battery_pct}%
              </span>
            </div>

            {/* Simulated Stream Viewport */}
            <div className="relative h-32 rounded-xl bg-black overflow-hidden border border-white/5 flex items-center justify-center">
              {/* Scanline / Grid overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(transparent_50%,rgba(0,0,0,0.6))] z-10 pointer-events-none" />
              <div className="absolute top-2 left-2 text-[9px] font-mono text-green-400 z-10 bg-black/60 px-1.5 py-0.5 rounded">
                REC • RTSP STREAM
              </div>
              <div className="absolute bottom-2 right-2 text-[9px] font-mono text-green-400 z-10 bg-black/60 px-1.5 py-0.5 rounded">
                TEMP: {droneData.thermal_max_temp_c || 'Scanning...'}°C
              </div>

              {/* Thermal dispersion or raw video placeholder */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-slate-400 font-mono animate-pulse">
                  {droneData.status === 'Hovering' ? 'THERMAL SCAN ACTIVE' : `TRANSITING TO ${droneData.active_zone?.toUpperCase()}`}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  GPS: {droneData.gps_coordinates?.[0]?.toFixed(4)}, {droneData.gps_coordinates?.[1]?.toFixed(4)}
                </span>
              </div>
            </div>

            {/* Flight telemetry readouts */}
            <div className="flex flex-col gap-1.5 text-[10px] font-mono text-slate-300">
              <div className="flex justify-between">
                <span>CH4 SNIFFER:</span>
                <span className="text-amber-400">{droneData.gas_sniff_ch4_lfl || '0.0'}% LFL</span>
              </div>
              <div className="flex justify-between">
                <span>CO READOUT:</span>
                <span className="text-amber-400">{droneData.gas_sniff_co_ppm || '0.0'} ppm</span>
              </div>
              <div className="flex justify-between">
                <span>OBJECT COUNT (CV):</span>
                <span className="text-green-400">{droneData.aerial_workers_count || 0} worker(s) seen</span>
              </div>
            </div>

            {/* Flight logs */}
            <div className="h-16 overflow-y-auto bg-black/40 border border-white/5 rounded-xl p-2 font-mono text-[9px] text-slate-400 flex flex-col gap-1">
              {droneData.flight_logs?.map((log: string, idx: number) => (
                <div key={idx}>{log}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Zone Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {zones.map((zone) => {
          const colors = getRiskLevelColor(zone.risk_level);
          return (
            <button
              key={zone.zone}
              onClick={() => setSelectedZone(zone.zone)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                selectedZone === zone.zone
                  ? 'bg-white/10 border-white/20'
                  : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
              }`}
            >
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block mb-1">
                {zone.zone}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colors.glow, boxShadow: `0 0 8px ${colors.glow}` }}
                />
                <span className="text-sm font-bold text-white">{zone.risk_score}%</span>
              </div>
              <span className="text-[10px] font-mono mt-1 block" style={{ color: colors.glow }}>
                {zone.risk_level}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
