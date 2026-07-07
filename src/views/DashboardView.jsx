import React, { useState, useEffect, useRef } from 'react';
import { useSafety } from '../context/SafetyContext';
import PlantLayout from '../components/PlantLayout';
import { Activity, ShieldCheck, Users, FileText, AlertTriangle, Play, Pause, RefreshCw } from 'lucide-react';

export default function DashboardView() {
  const {
    telemetry,
    permits,
    workers,
    logs,
    complianceScore,
    isPlaying,
    setIsPlaying,
    getZoneStatus,
    resetSimulation,
    zones,
  } = useSafety();

  const [selectedZone, setSelectedZone] = useState('coke-oven');
  const consoleEndRef = useRef(null);

  // Auto-scroll the logs console
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Calculations
  const activePermitsCount = permits.filter((p) => p.status === 'active').length;
  const activeWorkersCount = workers.filter((w) => w.zone !== 'control-room').length;
  
  // Overall state determination
  const statuses = Object.keys(zones).map(getZoneStatus);
  const overallStatus = statuses.includes('critical')
    ? 'CRITICAL'
    : statuses.includes('warning')
    ? 'WARNING'
    : 'SAFE';

  const statusClass = overallStatus.toLowerCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Simulation Controls & Global Status Banner */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="sim-control-panel">
            <span className={`sim-status-dot ${!isPlaying ? 'paused' : ''}`}></span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              SIMULATION: {isPlaying ? 'ACTIVE' : 'PAUSED'}
            </span>
          </div>
          <button className="btn btn-secondary" onClick={() => setIsPlaying(!isPlaying)} style={{ padding: '0.35rem 0.75rem' }}>
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? 'Pause' : 'Resume'}
          </button>
          <button className="btn btn-secondary" onClick={resetSimulation} style={{ padding: '0.35rem 0.75rem' }}>
            <RefreshCw size={14} /> Reset
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>GLOBAL PLANT STATUS:</span>
          <span
            className="permit-badge"
            style={{
              padding: '4px 12px',
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: overallStatus === 'CRITICAL' ? 'var(--color-critical-bg)' : overallStatus === 'WARNING' ? 'var(--color-warning-bg)' : 'var(--color-safe-bg)',
              color: overallStatus === 'CRITICAL' ? 'var(--color-critical)' : overallStatus === 'WARNING' ? 'var(--color-warning)' : 'var(--color-safe)',
              border: `1px solid ${overallStatus === 'CRITICAL' ? 'rgba(239, 68, 68, 0.3)' : overallStatus === 'WARNING' ? 'rgba(249, 115, 22, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
              boxShadow: overallStatus === 'CRITICAL' ? 'var(--color-critical-glow)' : overallStatus === 'WARNING' ? 'var(--color-warning-glow)' : 'var(--color-safe-glow)',
            }}
          >
            {overallStatus}
          </span>
        </div>
      </div>

      {/* Stats Cards Strip */}
      <div className="dashboard-stats-strip">
        <div className={`card stat-card ${statusClass}`}>
          <div className="stat-icon-wrapper">
            <ShieldCheck size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-value">{overallStatus}</span>
            <span className="stat-label">Plant Safety State</span>
          </div>
        </div>

        <div className="card stat-card info">
          <div className="stat-icon-wrapper">
            <Users size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-value">{activeWorkersCount}</span>
            <span className="stat-label">Workers in Active Zones</span>
          </div>
        </div>

        <div className="card stat-card info">
          <div className="stat-icon-wrapper">
            <FileText size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-value">{activePermitsCount}</span>
            <span className="stat-label">Active Permits (PTW)</span>
          </div>
        </div>

        <div className="card stat-card safe">
          <div className="stat-icon-wrapper">
            <Activity size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-value">{complianceScore}%</span>
            <span className="stat-label">Regulatory Audit Rating</span>
          </div>
        </div>
      </div>

      {/* Dashboard Main Grid: Heatmap + Details */}
      <div className="dashboard-grid">
        {/* Plant Layout Map Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <Activity size={18} style={{ color: 'var(--color-primary)' }} />
                Geospatial Safety Heatmap
              </h2>
              <span className="card-subtitle">Click on any facility zone to inspect real-time sensor streams</span>
            </div>
            <span className="permit-badge" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)' }}>
              2D Plan View
            </span>
          </div>

          <div className="heatmap-container" style={{ flexGrow: 1 }}>
            <PlantLayout selectedZone={selectedZone} onZoneSelect={setSelectedZone} />
          </div>
        </div>

        {/* Selected Zone Telemetry Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header" style={{ marginBottom: '1.25rem' }}>
              <div>
                <h2 className="card-title">
                  <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />
                  Zone Diagnostics
                </h2>
                <span className="card-subtitle">{zones[selectedZone].name}</span>
              </div>
              <span
                className="permit-badge"
                style={{
                  backgroundColor: getZoneStatus(selectedZone) === 'critical' ? 'var(--color-critical-bg)' : getZoneStatus(selectedZone) === 'warning' ? 'var(--color-warning-bg)' : 'var(--color-safe-bg)',
                  color: getZoneStatus(selectedZone) === 'critical' ? 'var(--color-critical)' : getZoneStatus(selectedZone) === 'warning' ? 'var(--color-warning)' : 'var(--color-safe)',
                }}
              >
                {getZoneStatus(selectedZone).toUpperCase()}
              </span>
            </div>

            {/* Metrics List */}
            <div className="telemetry-grid">
              <div className={`telemetry-node ${telemetry[selectedZone].co > 10 ? (telemetry[selectedZone].co > 15 ? 'critical' : 'warning') : 'safe'}`}>
                <div className="telemetry-node-header">
                  <span>Carbon Monoxide</span>
                </div>
                <span className="telemetry-node-val">{telemetry[selectedZone].co}</span>
                <span className="telemetry-node-label">ppm (Max 10)</span>
              </div>

              <div className={`telemetry-node ${telemetry[selectedZone].ch4 > 3 ? (telemetry[selectedZone].ch4 > 5 ? 'critical' : 'warning') : 'safe'}`}>
                <div className="telemetry-node-header">
                  <span>Methane</span>
                </div>
                <span className="telemetry-node-val">{telemetry[selectedZone].ch4}%</span>
                <span className="telemetry-node-label">LEL (Max 4.0)</span>
              </div>

              <div className={`telemetry-node ${telemetry[selectedZone].o2 < 19.5 || telemetry[selectedZone].o2 > 22 ? 'critical' : 'safe'}`}>
                <div className="telemetry-node-header">
                  <span>Oxygen</span>
                </div>
                <span className="telemetry-node-val">{telemetry[selectedZone].o2}%</span>
                <span className="telemetry-node-label">Normal range 20.9</span>
              </div>

              <div className={`telemetry-node ${telemetry[selectedZone].temp > 80 ? (telemetry[selectedZone].temp > 95 ? 'critical' : 'warning') : 'safe'}`}>
                <div className="telemetry-node-header">
                  <span>Temperature</span>
                </div>
                <span className="telemetry-node-val">{telemetry[selectedZone].temp}°C</span>
                <span className="telemetry-node-label">Pressure: {telemetry[selectedZone].pressure} bar</span>
              </div>
            </div>
          </div>

          {/* Active Permits & Workers inside selected zone */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
              Active Permits & Personnel in Zone
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {permits.filter(p => p.zone === selectedZone && p.status === 'active').length === 0 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No active permits in this zone.</span>
              )}
              {permits.filter(p => p.zone === selectedZone && p.status === 'active').map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{p.id} - {p.description.substring(0, 24)}...</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Worker: {p.worker}</span>
                  </div>
                  <span className={`permit-badge ${p.type}`}>{p.type.replace('-', ' ')}</span>
                </div>
              ))}

              <div style={{ marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Workers Inside: </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  {workers.filter(w => w.zone === selectedZone).map(w => `${w.name} (HR: ${w.heartRate} bpm)`).join(', ') || 'None'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Agent Console Card */}
      <div className="agent-logs-panel">
        <div className="agent-logs-header">
          <div className="console-dots">
            <span className="console-dot red"></span>
            <span className="console-dot yellow"></span>
            <span className="console-dot green"></span>
          </div>
          <span className="console-title">SENTINELSAFE MULTI-AGENT COLLABORATION BUS</span>
          <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>LOGGING ACTIVE</span>
        </div>

        <div className="agent-logs-content">
          {logs.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              &gt;_ Initializing Agent communications bus... Telemetry starts shortly.
            </div>
          )}
          {logs.map((log, index) => (
            <div key={index} className="log-entry">
              <div className="log-meta">
                <span className="log-timestamp">[{log.time}]</span>
                <span className={`log-agent ${log.agent}`}>{log.agent}</span>
                {log.status !== 'info' && (
                  <span className={`log-status ${log.status}`}>
                    {log.status.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="log-message">&gt; {log.message}</div>
            </div>
          ))}
          <div ref={consoleEndRef} />
        </div>
      </div>
    </div>
  );
}
