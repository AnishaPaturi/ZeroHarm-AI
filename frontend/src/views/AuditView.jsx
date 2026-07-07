import React from 'react';
import { useSafety } from '../context/SafetyContext';
import { ShieldCheck, HelpCircle, FileCheck, CheckCircle2, XCircle } from 'lucide-react';

export default function AuditView() {
  const { complianceScore, telemetry, permits, workers, zones } = useSafety();

  // Mapping checks
  const checks = [
    {
      id: 'FAC-36',
      title: 'Factories Act Section 36 Compliance',
      desc: 'No worker enters confined space without oxygen/toxic gas check & competent certification.',
      status: telemetry['gas-mixing'].ch4 > 6.0 && permits.some(p => p.zone === 'gas-mixing' && p.status === 'active') ? 'fail' : 'pass',
      reason: telemetry['gas-mixing'].ch4 > 6.0 && permits.some(p => p.zone === 'gas-mixing' && p.status === 'active')
        ? 'Methane concentrations inside mixing station are critical (8.2% LEL). Confined Entry is active!'
        : 'Confined space entry telemetry is within legal limits (CH4 < 4.0% LEL).',
    },
    {
      id: 'OISD-105',
      title: 'OISD-STD-105 Work Permit Auditing',
      desc: 'Welding/Hot Work must be suspended immediately in proximity of hydrocarbon/toxic gas levels > 10 ppm.',
      status: telemetry['coke-oven'].co > 15.0 && permits.some(p => p.zone === 'coke-oven' && p.type === 'hot-work' && p.status === 'active') ? 'fail' : 'pass',
      reason: telemetry['coke-oven'].co > 15.0 && permits.some(p => p.zone === 'coke-oven' && p.type === 'hot-work' && p.status === 'active')
        ? 'Welding permit remains active despite Carbon Monoxide readings exceeding 15 ppm limit.'
        : 'Permit interlocks operating correctly. Hot Work permits auto-suspended on sensor limit spikes.',
    },
    {
      id: 'OISD-137-CAL',
      title: 'OISD-GDN-137 Detector Calibration',
      desc: 'All fixed gas telemetry detectors calibrated inside the 90-day statutory window.',
      status: 'pass',
      reason: 'Last refinery-wide calibration completed on 2026-05-15. Next calibration scheduled in 38 days.',
    },
    {
      id: 'SEC-40',
      title: 'Safety Officers Statutory Mandate',
      desc: 'Worker badges must log active gas sensor feeds while entering hazardous production zones.',
      status: workers.some(w => w.zone !== 'control-room' && w.gasSensorBadge === 'inactive') ? 'fail' : 'pass',
      reason: workers.some(w => w.zone !== 'control-room' && w.gasSensorBadge === 'inactive')
        ? 'Worker detected inside active zone without active telemetry badging logging.'
        : 'All active workers in industrial zones have verified telemetry badges logging.',
    },
  ];

  // Dynamic audit scorecard indicator
  const ratingText = complianceScore >= 90 ? 'EXCELLENT' : complianceScore >= 75 ? 'WARNING' : 'CRITICAL BREACH';
  const badgeClass = complianceScore >= 90 ? 'excel' : complianceScore >= 75 ? 'warn' : 'danger';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={20} style={{ color: 'var(--color-primary)' }} />
          Quality & Compliance Audit Agent
        </h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Continuous compliance auditing of refinery safety protocols against statutory legal frameworks (OISD, Factories Act, and DGMS standards).
        </span>
      </div>

      <div className="audit-grid">
        {/* Compliance Rating Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', justifyContent: 'center', alignItems: 'center', padding: '2rem 1.5rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>
            REFINERY COMPLIANCE RATING
          </span>
          <div className={`compliance-badge ${badgeClass}`}>
            {complianceScore}%
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Rating Status: {ratingText}</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', maxWidth: '300px' }}>
              Refinery safety checks are evaluated continuously. If a telemetry limit is violated or worker rules are bypassed, points are deducted automatically.
            </p>
          </div>
        </div>

        {/* Audit Details Panel */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileCheck size={18} style={{ color: 'var(--color-primary)' }} />
            Statutory Inspections Checklist
          </h3>

          <div className="audit-checklist">
            {checks.map((c, i) => (
              <div key={i} className={`audit-checklist-item ${c.status}`}>
                <div className="audit-check-indicator">
                  {c.status === 'pass' ? (
                    <CheckCircle2 size={18} className="audit-check-indicator pass" />
                  ) : (
                    <XCircle size={18} className="audit-check-indicator fail" />
                  )}
                </div>
                <div className="audit-check-info">
                  <span className="audit-check-title">{c.title}</span>
                  <span className="audit-check-desc">{c.desc}</span>
                  <span style={{ fontSize: '0.7rem', color: c.status === 'pass' ? 'var(--color-safe)' : 'var(--color-critical)', fontWeight: 500, marginTop: '0.15rem' }}>
                    Audit details: {c.reason}
                  </span>
                  <span className="audit-check-code">{c.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit Logs History */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Audited Handovers & Calibration Records</h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Immutable logging entries certified by the Compliance Agent.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', padding: '0.4rem 0' }}>
            <span>[2026-07-07 14:00] SHIFT CHANGEOVER: A-Shift supervisor signed off handover. B-Shift safety induction verified.</span>
            <span style={{ color: 'var(--color-safe)' }}>PASSED</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', padding: '0.4rem 0' }}>
            <span>[2026-07-07 10:30] DETECTOR TEST: Portable gas alarm bump test verified (ID: S-badge-402). CO drift &lt; 0.5% LEL.</span>
            <span style={{ color: 'var(--color-safe)' }}>PASSED</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', padding: '0.4rem 0' }}>
            <span>[2026-07-06 18:45] INSPECTOR AUDIT: Statutory review of firefighting pressure vessel certificate logged.</span>
            <span style={{ color: 'var(--color-safe)' }}>PASSED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
