import React from 'react';
import { useSafety } from '../context/SafetyContext';
import { AlertOctagon, Bell, ShieldAlert, PhoneCall, ShieldCheck, FileText, ClipboardList } from 'lucide-react';

export default function EmergencyView() {
  const { emergency, triggerEmergency, resetSimulation, workers } = useSafety();

  const handleManualTrigger = () => {
    triggerEmergency('Manual Override: Evacuation triggered by Safety Officer in Command Center.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertOctagon size={20} style={{ color: 'var(--color-critical)' }} />
          Emergency Response Orchestrator
        </h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Coordinated safety checklist orchestration within the critical first 10 minutes of facility incidents.
        </span>
      </div>

      {!emergency.active ? (
        // Standard State: Evacuation Drill trigger
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', gap: '1.5rem', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContents: 'center', color: 'var(--text-secondary)' }}>
            <Bell size={40} style={{ margin: 'auto' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Drill Status: Standby</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '460px', marginTop: '0.5rem' }}>
              The emergency orchestrator is online. Sounding a mock evacuation drill will simulate the collaborative agent sequence: sirens, responder dispatches, gas shut-off valve command signals, and worker muster badge calculations.
            </p>
          </div>
          <button className="btn btn-danger" onClick={handleManualTrigger} style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}>
            <AlertOctagon size={18} />
            TRIGGER MANUAL EVACUATION PROTOCOL
          </button>
        </div>
      ) : (
        // Active Emergency State
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Pulsing Alarm Banner */}
          <div className="emergency-alert-banner">
            <div className="emergency-alert-icon-wrap">
              <AlertOctagon size={24} />
            </div>
            <div>
              <span className="emergency-alert-title">CRITICAL SAFETY BREACH — PLANT EVACUATION ACTIVE</span>
              <p className="emergency-alert-desc">
                Triggered: {emergency.timestamp} | Source: <strong>{emergency.triggerSource}</strong>
              </p>
            </div>
            <button className="btn btn-secondary" onClick={resetSimulation} style={{ marginLeft: 'auto', alignSelf: 'center' }}>
              Reset Alarms
            </button>
          </div>

          <div className="dashboard-grid">
            {/* Orchestration steps log */}
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardList size={18} style={{ color: 'var(--color-primary)' }} />
                Orchestration Checklist Sequence
              </h3>

              <div className="emergency-tasks-list">
                {/* Step 1 */}
                <div className={`emergency-task-item ${emergency.sirensActivated ? 'completed' : 'pending'}`}>
                  <Bell className="emergency-task-status-icon completed" />
                  <div className="emergency-task-details">
                    <span className="emergency-task-title">Evacuation Sirens Activated</span>
                    <span className="emergency-task-desc">Acoustic horn soundings (110dB) triggered in local facility sectors. Flashing warning signage enabled.</span>
                  </div>
                </div>

                {/* Step 2 */}
                <div className={`emergency-task-item ${emergency.teamsAlerted ? 'completed' : 'in-progress'}`}>
                  <PhoneCall className={`emergency-task-status-icon ${emergency.teamsAlerted ? 'completed' : 'in-progress'}`} />
                  <div className="emergency-task-details">
                    <span className="emergency-task-title">Emergency Response Team Dispatched</span>
                    <span className="emergency-task-desc">Automated SMS/WhatsApp API warnings dispatched to on-site fire team and refinery safety supervisors.</span>
                  </div>
                </div>

                {/* Step 3 */}
                <div className={`emergency-task-item ${emergency.valvesIsolated ? 'completed' : (emergency.teamsAlerted ? 'in-progress' : 'pending')}`}>
                  <ShieldAlert className={`emergency-task-status-icon ${emergency.valvesIsolated ? 'completed' : (emergency.teamsAlerted ? 'in-progress' : 'pending')}`} />
                  <div className="emergency-task-details">
                    <span className="emergency-task-title">Process Gas Isolation commanded</span>
                    <span className="emergency-task-desc">SCADA signal sent to close main valves (G-12 and G-14) to isolate flammable fuel flow.</span>
                  </div>
                </div>

                {/* Step 4 */}
                <div className={`emergency-task-item ${emergency.evacCount === emergency.evacTotal ? 'completed' : (emergency.valvesIsolated ? 'in-progress' : 'pending')}`}>
                  <ShieldCheck className={`emergency-task-status-icon ${emergency.evacCount === emergency.evacTotal ? 'completed' : (emergency.valvesIsolated ? 'in-progress' : 'pending')}`} />
                  <div className="emergency-task-details">
                    <span className="emergency-task-title">Muster Point Accounting</span>
                    <span className="emergency-task-desc">
                      Worker badge geolocation check: {emergency.evacCount} / {emergency.evacTotal} workers registered at Muster Point (Main Control Room).
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Generated regulatory compliance report */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} style={{ color: 'var(--color-info)' }} />
                Statutory Incident Report
              </h3>
              
              {!emergency.reportGenerated ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, color: 'var(--text-muted)', fontSize: '0.8rem', gap: '0.5rem' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-secondary)', animation: 'blink 1.4s infinite' }}></div>
                  <span>Compiling Factory Act compliance records...</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    SentinelSafe has auto-generated a preliminary incident summary report mapped against **Factories Act 1948 Section 36** templates.
                  </p>
                  <pre className="emergency-report-preview">
                    {emergency.reportText}
                  </pre>
                  <button className="btn btn-secondary" onClick={() => {
                    navigator.clipboard.writeText(emergency.reportText);
                    alert('Copied report to clipboard!');
                  }} style={{ fontSize: '0.75rem', marginTop: 'auto' }}>
                    Copy Incident Report
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
