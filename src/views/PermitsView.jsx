import React, { useState } from 'react';
import { useSafety } from '../context/SafetyContext';
import { FileText, AlertTriangle, CheckCircle, FilePlus, RefreshCcw } from 'lucide-react';

export default function PermitsView() {
  const { permits, setPermits, telemetry, zones, addLog } = useSafety();

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'hot-work',
    zone: 'coke-oven',
    worker: '',
    description: '',
    duration: '2 hrs',
  });

  const [formFeedback, setFormFeedback] = useState(null);

  // Form submit handler with automated safety analysis
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.worker || !formData.description) {
      alert('Please fill out all fields.');
      return;
    }

    const newId = `PTW-${Math.floor(Math.random() * 900) + 100}`;
    
    // Simulate AI audit before permitting
    const zoneTelemetry = telemetry[formData.zone];
    let isApproved = true;
    let auditLogMessage = '';
    let reason = '';

    if (formData.type === 'confined-space' && zoneTelemetry.o2 < 19.5) {
      isApproved = false;
      reason = `Oxygen level too low (${zoneTelemetry.o2}%). Minimum safe level is 19.5%.`;
    } else if (formData.type === 'hot-work' && zoneTelemetry.co > 10.0) {
      isApproved = false;
      reason = `Carbon Monoxide level too high (${zoneTelemetry.co} ppm). welding prohibited above 10 ppm.`;
    } else if (formData.zone === 'blast-furnace' && zoneTelemetry.temp > 80.0) {
      isApproved = false;
      reason = `Ambient temperature too high (${zoneTelemetry.temp}°C) for safe maintenance entry.`;
    }

    const timeStr = new Date().toLocaleTimeString().substring(0, 5);

    const newPermit = {
      id: newId,
      type: formData.type,
      zone: formData.zone,
      description: formData.description,
      worker: formData.worker,
      status: isApproved ? 'active' : 'suspended',
      issuedAt: timeStr,
      duration: formData.duration,
    };

    setPermits((prev) => [newPermit, ...prev]);

    if (isApproved) {
      addLog('PermitAgent', `✅ Permit ${newId} issued for ${formData.type.replace('-', ' ')} in ${zones[formData.zone].name}. Telemetry clean.`, 'info');
      setFormFeedback({ type: 'success', text: `Permit ${newId} approved and active immediately!` });
    } else {
      addLog('PermitAgent', `❌ Permit ${newId} BLOCKED/SUSPENDED during entry checks. Reason: ${reason}`, 'critical');
      addLog('RiskEngine', `🚨 Preemptive safety audit triggered: Denied permit ${newId} to prevent worker hazard.`, 'critical');
      setFormFeedback({ type: 'error', text: `Permit ${newId} BLOCKED by Safety Intelligence: ${reason}` });
    }

    // Reset form
    setFormData({
      type: 'hot-work',
      zone: 'coke-oven',
      worker: '',
      description: '',
      duration: '2 hrs',
    });

    setTimeout(() => {
      setFormFeedback(null);
      setShowForm(false);
    }, 4000);
  };

  // Check for SIMOPs conflicts to display in sub-panel
  const activePermits = permits.filter(p => p.status === 'active');
  const simopsConflicts = [];

  // Manual logic for SIMOPs conflicts
  // Check if multiple permits in the same zone
  const zoneCounts = {};
  activePermits.forEach(p => {
    zoneCounts[p.zone] = (zoneCounts[p.zone] || 0) + 1;
  });

  Object.keys(zoneCounts).forEach(zone => {
    if (zoneCounts[zone] > 1) {
      const zonePermits = activePermits.filter(p => p.zone === zone);
      simopsConflicts.push({
        zone,
        title: `SIMOPs Conflict: Multiple active tasks in ${zones[zone].name}`,
        desc: `Permits [${zonePermits.map(zp => zp.id).join(', ')}] are operating in the same workspace. Heightened risk of operational overlap.`,
      });
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} style={{ color: 'var(--color-primary)' }} />
            Digital Permit Intelligence (PTW)
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Real-time Work Permit tracking, simultaneous operations (SIMOPs) auditing, and automatic telemetry validation.
          </span>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <FilePlus size={16} />
          {showForm ? 'Cancel Request' : 'New Permit Request'}
        </button>
      </div>

      {/* New Permit Request Form Panel */}
      {showForm && (
        <div className="card" style={{ border: '1px solid rgba(99, 102, 241, 0.4)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Initiate Safety-Validated Permit Request</h3>
          
          {formFeedback && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                backgroundColor: formFeedback.type === 'success' ? 'var(--color-safe-bg)' : 'var(--color-critical-bg)',
                color: formFeedback.type === 'success' ? 'var(--color-safe)' : 'var(--color-critical)',
                border: `1px solid ${formFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              {formFeedback.text}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Permit Category</label>
              <select
                className="chat-input"
                style={{ padding: '0.5rem' }}
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="hot-work">Hot Work (Welding, Grinding)</option>
                <option value="confined-space">Confined Space Entry</option>
                <option value="height-work">Work at Heights (&gt; 2 meters)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Target Zone</label>
              <select
                className="chat-input"
                style={{ padding: '0.5rem' }}
                value={formData.zone}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
              >
                {Object.keys(zones).map(key => (
                  <option key={key} value={key}>{zones[key].name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Assignee / Contractor Name</label>
              <input
                type="text"
                placeholder="e.g. Rajesh Kumar (ID: W-304)"
                className="chat-input"
                style={{ padding: '0.5rem' }}
                value={formData.worker}
                onChange={(e) => setFormData({ ...formData, worker: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Estimated Duration</label>
              <select
                className="chat-input"
                style={{ padding: '0.5rem' }}
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              >
                <option value="1 hr">1 Hour</option>
                <option value="2 hrs">2 Hours</option>
                <option value="4 hrs">4 Hours</option>
                <option value="8 hrs">8 Hours</option>
              </select>
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Detailed Task Description</label>
              <textarea
                placeholder="State the precise purpose of entry or maintenance..."
                className="chat-input"
                rows="2"
                style={{ padding: '0.5rem', resize: 'none' }}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Submit for AI Safety Validation</button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Active Permits Table + SIMOPs Conflicts Alert */}
      <div className="dashboard-grid">
        {/* Permits Table Card */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Permit Register</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="permit-table">
              <thead>
                <tr>
                  <th>Permit ID</th>
                  <th>Type</th>
                  <th>Facility Zone</th>
                  <th>Task Description</th>
                  <th>Assignee</th>
                  <th>Start</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {permits.map((permit) => {
                  const isSuspended = permit.status === 'suspended';
                  return (
                    <tr key={permit.id} className={`permit-row ${isSuspended ? 'conflict' : ''}`}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{permit.id}</td>
                      <td>
                        <span className={`permit-badge ${permit.type}`}>
                          {permit.type.replace('-', ' ')}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {zones[permit.zone].name}
                      </td>
                      <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {permit.description}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{permit.worker}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {permit.issuedAt}
                      </td>
                      <td>
                        <span className={`status-indicator ${permit.status}`}>
                          <span className="status-indicator-dot"></span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: permit.status === 'active' ? 'var(--color-safe)' : permit.status === 'suspended' ? 'var(--color-critical)' : 'var(--color-warning)' }}>
                            {permit.status}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SIMOPs / Conflict Alerts Side Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* AI Permit Audit Report */}
          <div className="card">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />
              Simultaneous Operations (SIMOPs) Audit
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Permit Intelligence Agent continuously scans overlap conflicts and safe proximity boundaries.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {simopsConflicts.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-safe-bg)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                  <CheckCircle size={16} style={{ color: 'var(--color-safe)' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-safe)', fontWeight: 500 }}>
                    SIMOPs Audit Passed. No active location conflicts.
                  </span>
                </div>
              )}

              {simopsConflicts.map((c, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fca5a5' }}>{c.title}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{c.desc}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-critical)', fontWeight: 600, marginTop: '0.25rem', textTransform: 'uppercase' }}>
                    🚨 Preemptive Action: Close supervision mandated.
                  </span>
                </div>
              ))}

              {/* Automatic Suspensions Audit list */}
              {permits.filter(p => p.status === 'suspended').map((p) => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-critical)' }}>Auto-Suspension: {p.id}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Permit suspended for worker {p.worker} inside {zones[p.zone].name}.
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-critical)', fontWeight: 600, marginTop: '0.25rem' }}>
                    REASON: Telemetry exceeded safe permit limit during active operations.
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
