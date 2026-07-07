import React from 'react';
import { useSafety } from './context/SafetyContext';

// Import Views
import DashboardView from './views/DashboardView';
import HeatmapView from './views/HeatmapView';
import PermitsView from './views/PermitsView';
import SafetyChatView from './views/SafetyChatView';
import EmergencyView from './views/EmergencyView';
import AuditView from './views/AuditView';

// Icons
import {
  LayoutDashboard,
  Map,
  FileText,
  MessageSquare,
  AlertOctagon,
  ShieldCheck,
  Flame,
  Bell,
  HelpCircle,
} from 'lucide-react';

export default function App() {
  const {
    activeView,
    setActiveView,
    complianceScore,
    emergency,
    zones,
    getZoneStatus,
    telemetry,
  } = useSafety();

  // Highlight active alarm state globally in the shell
  const isEmergencyActive = emergency.active;

  // Header Subtitle mapping based on active view
  const getViewDetails = () => {
    switch (activeView) {
      case 'dashboard':
        return {
          title: 'Command Center Overview',
          subtitle: 'Real-time telemetry aggregation, spatial health mapping, and collaborative AI safety analysis.',
        };
      case 'heatmap':
        return {
          title: 'Geospatial Heatmap',
          subtitle: 'Active hazard coordinates, worker badge distributions, and dynamic plant structure risks.',
        };
      case 'permits':
        return {
          title: 'Permit Intelligence (PTW)',
          subtitle: 'Continuous validation of active and pending permits against live sensor metrics.',
        };
      case 'chat':
        return {
          title: 'Regulatory & Incident RAG Agent',
          subtitle: 'Instant statutory lookups and incident findings mapped directly against official guidelines.',
        };
      case 'emergency':
        return {
          title: 'Emergency Orchestrator',
          subtitle: 'Evacuation tracking, safety checklist logging, and SCADA process isolation status.',
        };
      case 'audit':
        return {
          title: 'Quality & Compliance Auditing',
          subtitle: 'Daily handoffs, equipment check logs, and legal safety checklist audits.',
        };
      default:
        return { title: 'SentinelSafe', subtitle: 'Zero-Harm Safety Intelligence' };
    }
  };

  const viewInfo = getViewDetails();

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-section">
          <Flame className="brand-icon" size={24} />
          <span className="brand-name">SentinelSafe</span>
          <span className="brand-version">v1.2</span>
        </div>

        <nav className="nav-links">
          <div
            className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveView('dashboard')}
          >
            <LayoutDashboard className="nav-icon" />
            <span>Dashboard</span>
          </div>

          <div
            className={`nav-item ${activeView === 'heatmap' ? 'active' : ''}`}
            onClick={() => setActiveView('heatmap')}
          >
            <Map className="nav-icon" />
            <span>Geospatial Map</span>
          </div>

          <div
            className={`nav-item ${activeView === 'permits' ? 'active' : ''}`}
            onClick={() => setActiveView('permits')}
          >
            <FileText className="nav-icon" />
            <span>Permit Register</span>
          </div>

          <div
            className={`nav-item ${activeView === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveView('chat')}
          >
            <MessageSquare className="nav-icon" />
            <span>Incident RAG Chat</span>
          </div>

          <div
            className={`nav-item ${activeView === 'emergency' ? 'active' : ''} ${isEmergencyActive ? 'pulse-red-border' : ''}`}
            onClick={() => setActiveView('emergency')}
            style={isEmergencyActive ? { color: 'var(--color-critical)', fontWeight: 700 } : {}}
          >
            <AlertOctagon className="nav-icon" style={isEmergencyActive ? { color: 'var(--color-critical)' } : {}} />
            <span>Emergency Panel</span>
            {isEmergencyActive && (
              <span className="sim-status-dot" style={{ backgroundColor: 'var(--color-critical)', marginLeft: 'auto' }}></span>
            )}
          </div>

          <div
            className={`nav-item ${activeView === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveView('audit')}
          >
            <ShieldCheck className="nav-icon" />
            <span>Compliance Audit</span>
          </div>
        </nav>

        {/* Sidebar Footer Compliance Score Card */}
        <div className="sidebar-footer">
          <div className="compliance-health">
            <div className="compliance-header">
              <span>Compliance Score</span>
              <span>{complianceScore}%</span>
            </div>
            <div className="compliance-bar-outer">
              <div
                className="compliance-bar-inner"
                style={{
                  width: `${complianceScore}%`,
                  backgroundColor: complianceScore >= 90 ? 'var(--color-safe)' : complianceScore >= 75 ? 'var(--color-warning)' : 'var(--color-critical)',
                  boxShadow: complianceScore >= 90 ? 'var(--color-safe-glow)' : complianceScore >= 75 ? 'var(--color-warning-glow)' : 'var(--color-critical-glow)',
                }}
              ></div>
            </div>
          </div>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
            Statutory framework: OISD / DGMS
          </div>
        </div>
      </aside>

      {/* Main Page Area */}
      <main className="main-content">
        {/* Top Header Row */}
        <header className="top-header">
          <div className="page-title-section">
            <h1>{viewInfo.title}</h1>
            <p className="page-subtitle">{viewInfo.subtitle}</p>
          </div>

          <div className="header-actions">
            {/* Flashing global emergency banner if triggered */}
            {isEmergencyActive && (
              <div
                onClick={() => setActiveView('emergency')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'var(--color-critical-bg)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  padding: '0.5rem 1rem',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  color: 'var(--color-critical)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  animation: 'blink 1.5s infinite',
                }}
              >
                <Bell size={14} />
                <span>EVACUATION PROTOCOL IN PROGRESS</span>
              </div>
            )}

            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
              <span>Location:</span>
              <strong style={{ color: 'var(--text-primary)' }}>Vizag Sector 4</strong>
            </div>
          </div>
        </header>

        {/* View Routing Render */}
        <section style={{ flexGrow: 1 }}>
          {activeView === 'dashboard' && <DashboardView />}
          {activeView === 'heatmap' && <HeatmapView />}
          {activeView === 'permits' && <PermitsView />}
          {activeView === 'chat' && <SafetyChatView />}
          {activeView === 'emergency' && <EmergencyView />}
          {activeView === 'audit' && <AuditView />}
        </section>
      </main>
    </div>
  );
}
