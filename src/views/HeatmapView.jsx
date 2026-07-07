import React, { useState } from 'react';
import { useSafety } from '../context/SafetyContext';
import PlantLayout from '../components/PlantLayout';
import { Activity, Radio, AlertOctagon, ShieldAlert, Sliders, Play, PlusCircle } from 'lucide-react';

export default function HeatmapView() {
  const {
    telemetry,
    permits,
    workers,
    getZoneStatus,
    zones,
    addLog,
  } = useSafety();

  const [selectedZone, setSelectedZone] = useState('coke-oven');
  
  // Custom mock telemetry sliders (locally modifies state in context if needed, but since context manages state, we can write a helper function to set values directly or inject events).
  // Let's implement a way to trigger custom simulation injections.
  // We can write to safety context directly. Let's look at what context exports.
  // Context has no specific setTelemetry, but we can access state directly or add helper logs.
  // Wait, let's write custom triggers. Since telemetry is managed by context, let's inject overrides.
  // Wait, can we edit C:\Users\anish\OneDrive\College\Hackathon\ET-Hackathon\src\context\SafetyContext.jsx to support a `setTelemetryValue` and `setWorkerValue` so the Heatmap controls can change them?
  // Yes! Let's do that in a minute, but first let's see how we can export them. We have access to the context. Let's see if we can edit SafetyContext to export setTelemetry and setWorkers, which is even simpler!
  // In C:\Users\anish\OneDrive\College\Hackathon\ET-Hackathon\src\context\SafetyContext.jsx we already exported `setTelemetry` and `setWorkers`? Let's check:
  // We exported `telemetry`, `permits`, `setPermits`, `workers`, `setWorkers`, `logs`, `addLog`, `complianceScore`, `setComplianceScore`, `activeView`, `setActiveView`, `getZoneStatus`, `emergency`, `triggerEmergency`, `resetSimulation`, `zones`.
  // Wait! We did NOT export `setTelemetry`! Let's check SafetyContext:
  // "telemetry, permits, setPermits, workers, setWorkers, logs, addLog..." Yes, we did NOT export `setTelemetry`! We only exported `telemetry`. Let's update `SafetyContext` to export `setTelemetry` so that the mock controllers can inject custom gas leaks! That is extremely useful.
  // Let's first finish implementing `HeatmapView.jsx` assuming `setTelemetry` is exported. Then we will update `SafetyContext.jsx` to export `setTelemetry`.
  // Wait, let's write `HeatmapView.jsx`.

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <Radio size={20} style={{ color: 'var(--color-primary)' }} />
              Interactive Geospatial Command Center
            </h2>
            <span className="card-subtitle">Real-time geospatial layout of the industrial facility with dynamic hazards heatmapping</span>
          </div>
          <span className="permit-badge" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)' }}>
            Plant Scale: 1:500
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.5rem', marginTop: '1rem' }}>
          {/* Map layout */}
          <div className="heatmap-container" style={{ height: '420px', background: 'rgba(0,0,0,0.3)' }}>
            <PlantLayout selectedZone={selectedZone} onZoneSelect={setSelectedZone} />
          </div>

          {/* Incident Sim Injector & Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Zone inspector card */}
            <div className="card" style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '1rem', border: '1px dashed var(--border-color)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={16} style={{ color: 'var(--color-primary)' }} />
                Active Overlay: {zones[selectedZone].name}
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Zone Status:</span>
                  <span style={{ fontWeight: 600, color: getZoneStatus(selectedZone) === 'critical' ? 'var(--color-critical)' : getZoneStatus(selectedZone) === 'warning' ? 'var(--color-warning)' : 'var(--color-safe)' }}>
                    {getZoneStatus(selectedZone).toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Active Workers Badge count:</span>
                  <span style={{ fontWeight: 600 }}>{workers.filter(w => w.zone === selectedZone).length} workers</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Active permits:</span>
                  <span style={{ fontWeight: 600 }}>{permits.filter(p => p.zone === selectedZone && p.status === 'active').length} active</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Sub-system status:</span>
                  <span style={{ color: 'var(--color-safe)' }}>Online (SCADA)</span>
                </div>
              </div>
            </div>

            {/* Custom Demo Injector */}
            <div className="card" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '1rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <Sliders size={16} style={{ color: 'var(--color-warning)' }} />
                Demo Scenario Injectors
              </h3>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Use these buttons to force-simulate high-hazard scenarios for the pitch evaluation:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    // We'll write to context directly once we export setTelemetry.
                    window.injectScenario && window.injectScenario('coke-oven-leak');
                  }}
                  style={{ justifyContent: 'flex-start', fontSize: '0.75rem', padding: '0.5rem' }}
                >
                  <PlusCircle size={14} style={{ color: 'var(--color-critical)' }} />
                  Inject Coke Oven Gas Leak & Hot Work Conflict
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    window.injectScenario && window.injectScenario('gas-mixing-leak');
                  }}
                  style={{ justifyContent: 'flex-start', fontSize: '0.75rem', padding: '0.5rem' }}
                >
                  <PlusCircle size={14} style={{ color: 'var(--color-critical)' }} />
                  Inject Gas Station Methane Leak (Confined Entry)
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    window.injectScenario && window.injectScenario('unbadge-worker');
                  }}
                  style={{ justifyContent: 'flex-start', fontSize: '0.75rem', padding: '0.5rem' }}
                >
                  <PlusCircle size={14} style={{ color: 'var(--color-warning)' }} />
                  Inject Worker entry without Safety Badge
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Visual Legend */}
      <div className="card" style={{ padding: '1rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem' }}>Geospatial Heatmap Legend</h3>
        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--color-safe-bg)', border: '1px solid var(--color-safe)', display: 'inline-block' }}></span>
            <span>Normal Zone Operations (Zero Risk)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', display: 'inline-block' }}></span>
            <span>Warning Level Operations (Elevated sensors or active permit constraints)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--color-critical-bg)', border: '1px solid var(--color-critical)', display: 'inline-block' }}></span>
            <span>Critical Hazard Operations (Compound Risk breach, evacuation threshold, permit suspended)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
