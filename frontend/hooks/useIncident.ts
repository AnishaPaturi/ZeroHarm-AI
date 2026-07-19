import { create } from 'zustand';
import { Incident, IncidentAIAnalysis, Comment, IncidentStatus, IncidentSeverity } from '../types/incident';
import { ComplianceRecord, SafetyAlert } from '../types/analytics';
import { AppEvent } from '../lib/eventBus';
import { fetchBackend } from '../services/api';

// Default Nominal Roster & Parameters
const DEFAULT_TELEMETRY = { gasLpgLEL: 0, segmentDPressure: 0, temperature: 0 };
const DEFAULT_WORKERS: any[] = [];
const DEFAULT_PERMITS: any[] = [];
const DEFAULT_ALERTS: SafetyAlert[] = [];
const DEFAULT_COMPLIANCE: ComplianceRecord[] = [];
const DEFAULT_INCIDENTS: Incident[] = [];

interface IncidentStore {
  // Raw States
  telemetry: typeof DEFAULT_TELEMETRY;
  workers: typeof DEFAULT_WORKERS;
  incidents: Incident[];
  alerts: SafetyAlert[];
  complianceRecords: ComplianceRecord[];
  activePermits: typeof DEFAULT_PERMITS;
  emergencyMode: boolean;
  evacuationMessage: string;
  eventLogs: AppEvent[];
  aiReasoning: { reasoning: string; recommendations: string[]; detectedHazards: string[] };
  activeDebate: any | null;
  nearMisses: any[];

  // Diagnostic states
  activeIncident: Incident | null;
  isLoading: boolean;
  isAnalyzing: boolean;
  analysisStep: number;
  analysisDetail: string;

  // Actions
  updateTelemetry: (data: Partial<typeof DEFAULT_TELEMETRY>) => void;
  setWorkers: (workers: typeof DEFAULT_WORKERS) => void;
  setPermits: (permits: typeof DEFAULT_PERMITS) => void;
  setComplianceRecords: (records: ComplianceRecord[]) => void;
  addAlert: (alert: SafetyAlert) => void;
  removeAlert: (id: string) => void;
  addIncident: (incident: Incident) => void;
  updateIncident: (id: string, updates: Partial<Incident>) => void;
  setEmergency: (active: boolean, msg?: string) => void;
  setAIReasoning: (reasoning: string, recommendations: string[], hazards: string[]) => void;
  setActiveDebate: (debate: any) => void;
  setNearMisses: (nearMisses: any[]) => void;
  logEvent: (event: AppEvent) => void;
  resetStore: () => void;

  // UI operational actions
  selectIncident: (id: string) => void;
  submitComment: (incidentId: string, authorName: string, authorRole: any, content: string) => void;
  runAIAnalysis: (incidentId: string) => Promise<void>;
  reportNewIncident: (incidentData: Omit<Incident, 'id' | 'reportedAt' | 'comments' | 'status'>) => Promise<Incident>;
}

export const useIncident = create<IncidentStore>((set, get) => ({
  // Init state
  telemetry: { ...DEFAULT_TELEMETRY },
  workers: [...DEFAULT_WORKERS],
  incidents: [...DEFAULT_INCIDENTS],
  alerts: [...DEFAULT_ALERTS],
  complianceRecords: [...DEFAULT_COMPLIANCE],
  activePermits: [...DEFAULT_PERMITS],
  emergencyMode: false,
  evacuationMessage: '',
  eventLogs: [],
  aiReasoning: {
    reasoning: 'Connecting to ZeroHarm safety system server...',
    recommendations: [],
    detectedHazards: []
  },
  activeDebate: null,
  nearMisses: [],

  activeIncident: null,
  isLoading: false,
  isAnalyzing: false,
  analysisStep: 0,
  analysisDetail: '',

  // Raw State setters called exclusively by Decision Engine
  updateTelemetry: (data) => set((s) => ({ telemetry: { ...s.telemetry, ...data } })),
  setWorkers: (workers) => set({ workers }),
  setPermits: (permits) => set({ activePermits: permits }),
  setComplianceRecords: (records) => set({ complianceRecords: records }),
  addAlert: (alert) => set((s) => ({ alerts: [alert, ...s.alerts] })),
  removeAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
  addIncident: (incident) => set((s) => ({ incidents: [incident, ...s.incidents] })),
  updateIncident: (id, updates) => set((s) => {
    const updated = s.incidents.map(inc => inc.id === id ? { ...inc, ...updates } : inc);
    const active = s.activeIncident?.id === id ? { ...s.activeIncident, ...updates } : s.activeIncident;
    return { incidents: updated, activeIncident: active };
  }),
  setEmergency: (active, msg) => set({ emergencyMode: active, evacuationMessage: msg || '' }),
  setAIReasoning: (reasoning, recommendations, detectedHazards) => set({ aiReasoning: { reasoning, recommendations, detectedHazards } }),
  setActiveDebate: (debate) => set({ activeDebate: debate }),
  setNearMisses: (nearMisses) => set({ nearMisses }),
  logEvent: (event) => set((s) => ({ eventLogs: [event, ...s.eventLogs].slice(0, 100) })), // limit audit log count

  resetStore: () => set({
    telemetry: { ...DEFAULT_TELEMETRY },
    workers: [...DEFAULT_WORKERS],
    incidents: [...DEFAULT_INCIDENTS],
    alerts: [...DEFAULT_ALERTS],
    complianceRecords: [...DEFAULT_COMPLIANCE],
    activePermits: [...DEFAULT_PERMITS],
    emergencyMode: false,
    evacuationMessage: '',
    aiReasoning: {
      reasoning: 'All operational parameters (sensors, workers, permits) align with safe guidelines. Compound risk: 10%.',
      recommendations: ['Maintain normal plant safety surveillance rounds.'],
      detectedHazards: ['None']
    },
    activeDebate: null,
    nearMisses: [],
    activeIncident: null,
    isAnalyzing: false
  }),

  // UI triggered operations
  selectIncident: (id) => {
    const found = get().incidents.find(i => i.id === id) || null;
    set({ activeIncident: found });
  },

  submitComment: (incidentId, authorName, authorRole, content) => {
    const comment: Comment = {
      id: `c_${Date.now()}`,
      authorName,
      authorRole,
      content,
      timestamp: new Date().toISOString()
    };

    set((state) => {
      const updated = state.incidents.map(inc => {
        if (inc.id === incidentId) {
          return { ...inc, comments: [...inc.comments, comment] };
        }
        return inc;
      });
      const active = state.activeIncident?.id === incidentId 
        ? { ...state.activeIncident, comments: [...state.activeIncident.comments, comment] }
        : state.activeIncident;
      return { incidents: updated, activeIncident: active };
    });
  },

  reportNewIncident: async (incidentData) => {
    const created: Incident = {
      ...incidentData,
      id: `inc_${Date.now()}`,
      reportedAt: new Date().toISOString(),
      status: 'Reported',
      comments: []
    };
    set((s) => ({ incidents: [created, ...s.incidents] }));
    return created;
  },

  runAIAnalysis: async (incidentId) => {
    set({ isAnalyzing: true, analysisStep: 0, analysisDetail: 'Initializing diagnostics...' });
    const pipelineSteps = [
      'Scanning incident log descriptors...',
      'Extracting telemetry log overlaps...',
      'Evaluating regulatory thresholds...',
      'Cross-referencing legal codes (OISD / Factory Act)...',
      'Deploying Multi-Agent Safety Committee...',
      'Running collaborative agent safety debate...',
      'Synthesizing compound consensus metrics...'
    ];

    for (let i = 0; i < pipelineSteps.length; i++) {
      set({ analysisStep: i, analysisDetail: pipelineSteps[i] });
      await new Promise(r => setTimeout(r, 600));
    }

    const target = get().incidents.find(i => i.id === incidentId);
    if (!target) return;

    let debateData: any = null;
    let backendAnalysis: any = null;

    try {
      let zone = 'Coke Oven Battery 1';
      const loc = (target.location || '').toLowerCase();
      if (loc.includes('furnace') || loc.includes('blast')) zone = 'Blast Furnace A';
      else if (loc.includes('sinter')) zone = 'Sinter Plant';
      else if (loc.includes('ammonia') || loc.includes('storage')) zone = 'Ammonia Storage Tank';

      const response = await fetchBackend<any>('/api/integration/full-assessment', {
        method: 'POST',
        body: JSON.stringify({ zone })
      });

      if (response) {
        backendAnalysis = response;
        if (response.collaborative_debate) {
          debateData = response.collaborative_debate;
        }
      }
    } catch (e) {
      console.warn('Backend full assessment failed or server offline, using local mock.', e);
    }

    let aiAnalysis: IncidentAIAnalysis;

    if (backendAnalysis) {
      const risk = backendAnalysis.risk_assessment || {};
      const permit = backendAnalysis.permit_audit || {};
      
      const hazards = Array.isArray(risk.factors) 
        ? risk.factors.map((f: any) => f.name) 
        : ['Uncontrolled energy discharge'];
      
      const actions = Array.isArray(risk.factors) 
        ? risk.factors.map((f: any) => f.details) 
        : [backendAnalysis.unified_action];

      aiAnalysis = {
        riskLevel: target.severity,
        confidenceScore: debateData ? Math.round(debateData.risk_probability) : (risk.composite_risk_score || 85),
        detectedHazards: hazards,
        rootCause: backendAnalysis.compliance_narrative || 'Precedent search completed. Compound safety boundaries compromised.',
        recommendedPPE: ['Flame Resistant Coveralls (FRC)', 'Atmosphere Sniffer Probe', 'Class A Safety Helmet'],
        violatedRegulations: Array.isArray(permit.conflicts) 
          ? permit.conflicts.map((c: any) => ({
              regulation: c.conflict_type || 'OISD Standard Variance',
              act: 'OISD' as const,
              description: c.details,
              severity: 'Major' as const
            }))
          : [],
        immediateActions: actions,
        preventiveMeasures: ['Deploy mobile exhaust fan units', 'Calibrate gas sniffers'],
        similarIncidents: [
          { id: 'inc_prev_1', title: 'Historical Pipeline Leakage Case Log', severity: 'High', similarity: 82, date: '2026-07-16' }
        ],
        timeline: [
          { id: 't_1', title: 'Incident Registered', description: 'Logged into desk', timestamp: 'Just now', status: 'completed' },
          { id: 't_2', title: 'AI Diagnostics', description: 'RAG search completed', timestamp: 'Just now', status: 'completed' }
        ],
        collaborativeDebate: debateData
      };
    } else {
      const localDebate = generateMockDebate(target.location, target.severity);
      debateData = localDebate;
      
      aiAnalysis = {
        riskLevel: target.severity,
        confidenceScore: Math.round(localDebate.risk_probability),
        detectedHazards: localDebate.compound_factors,
        rootCause: localDebate.final_consensus,
        recommendedPPE: ['Flame Resistant Coveralls (FRC)', 'Atmosphere Sniffer Probe', 'Class A Safety Helmet'],
        violatedRegulations: [
          { regulation: 'OISD-STD-105 Sec 4.1', act: 'OISD' as const, description: 'Safety permit audit variance in zone boundary.', severity: 'Major' as const }
        ],
        immediateActions: localDebate.recommendations,
        preventiveMeasures: ['Replace mechanical relief spring', 'Recalibrate sensor transducer nodes'],
        similarIncidents: [
          { id: 'inc_prev_1', title: 'Overlapping Operational Risk Precedent', severity: 'High', similarity: 85, date: '2026-07-16' }
        ],
        timeline: [
          { id: 't_1', title: 'Incident Registered', description: 'Logged into desk', timestamp: 'Just now', status: 'completed' },
          { id: 't_2', title: 'AI Diagnostics', description: 'RAG search completed', timestamp: 'Just now', status: 'completed' }
        ],
        collaborativeDebate: localDebate
      };
    }

    set((s) => {
      const updated = s.incidents.map(inc => inc.id === incidentId ? { ...inc, status: 'RCA Complete' as IncidentStatus, aiAnalysis: aiAnalysis } : inc);
      const active = s.activeIncident?.id === incidentId ? { ...s.activeIncident, status: 'RCA Complete' as IncidentStatus, aiAnalysis: aiAnalysis } : s.activeIncident;
      return { incidents: updated, activeIncident: active, activeDebate: debateData, isAnalyzing: false };
    });
  }
}));

// ==========================================
// MEMOIZED COMPUTED SELECTORS (PURE DERIVATIONS)
// ==========================================

export interface MonthlyIncidentCount {
  month: string;
  incidents: number;
  critical: number;
}

export interface DepartmentIncidentStats {
  department: string;
  incidents: number;
  resolved: number;
}

export interface ExecutiveReport {
  id: string;
  name: string;
  date: string;
  size: string;
  description: string;
}

// 1. Safety Index (0-100) calculated from active parameters
export const selectPlantSafetyRating = (state: IncidentStore): number => {
  let score = 100;

  // Penalize open incidents
  const openIncidents = state.incidents.filter(i => i.status !== 'Resolved');
  openIncidents.forEach(inc => {
    if (inc.severity === 'Critical') score -= 15;
    else if (inc.severity === 'High') score -= 10;
    else if (inc.severity === 'Medium') score -= 5;
    else score -= 2;
  });

  // Penalize active alerts
  state.alerts.forEach(alert => {
    if (alert.severity === 'Critical') score -= 8;
    else if (alert.severity === 'Warning') score -= 4;
    else score -= 1;
  });

  // Penalize high gas LEL
  if (state.telemetry.gasLpgLEL > 10) {
    score -= (state.telemetry.gasLpgLEL - 10) * 1.5;
  }

  // Penalize high pressure
  if (state.telemetry.segmentDPressure > 11.5) {
    score -= (state.telemetry.segmentDPressure - 11.5) * 8;
  }

  // Penalize active PPE violations
  const activePPEBreaches = state.workers.filter(w => !w.ppeOk).length;
  score -= activePPEBreaches * 5;

  return Math.max(10, Math.min(100, Math.round(score)));
};

// 2. Derived Overall Risk Categorization
export const selectOverallRisk = (state: IncidentStore): 'Low' | 'Medium' | 'High' | 'Critical' => {
  const rating = selectPlantSafetyRating(state);
  if (rating >= 90) return 'Low';
  if (rating >= 75) return 'Medium';
  if (rating >= 60) return 'High';
  return 'Critical';
};

// 3. Count selector for active alerts
export const selectCriticalAlertCount = (state: IncidentStore): number => {
  return state.alerts.filter(a => a.severity === 'Critical').length;
};

// 4. Count selector for unresolved incidents
export const selectOpenIncidentCount = (state: IncidentStore): number => {
  return state.incidents.filter(i => i.status !== 'Resolved').length;
};

// 5. Compliance level selectors
export const selectCompliancePercentage = (state: IncidentStore): number => {
  const records = state.complianceRecords;
  if (records.length === 0) return 100;
  const compliant = records.filter(r => r.status === 'Compliant').length;
  const pending = records.filter(r => r.status === 'Pending Audit').length;
  // Weight pending audits as 50% compliant, compliant as 100%
  const score = ((compliant + (pending * 0.5)) / records.length) * 100;
  return parseFloat(score.toFixed(1));
};

// 6. Active crew counting
export const selectActiveWorkers = (state: IncidentStore): number => {
  return state.workers.length;
};

// 7. Dynamic Monthly Incident History derived selector with Module caching
let lastMonthlyIncidents: Incident[] | null = null;
let lastMonthlyData: MonthlyIncidentCount[] = [];

export const selectMonthlyIncidentData = (state: IncidentStore): MonthlyIncidentCount[] => {
  if (state.incidents === lastMonthlyIncidents) {
    return lastMonthlyData;
  }
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();
  
  const data: Record<string, { incidents: number; critical: number }> = {};
  for (let i = 0; i <= currentMonthIndex; i++) {
    data[months[i]] = { incidents: 0, critical: 0 };
  }

  state.incidents.forEach(inc => {
    const date = new Date(inc.reportedAt);
    if (date.getFullYear() === currentYear) {
      const m = months[date.getMonth()];
      if (data[m]) {
        data[m].incidents += 1;
        if (inc.severity === 'Critical') {
          data[m].critical += 1;
        }
      }
    }
  });

  const result = Object.entries(data).map(([month, stats]) => ({
    month,
    incidents: stats.incidents,
    critical: stats.critical
  }));

  lastMonthlyIncidents = state.incidents;
  lastMonthlyData = result;
  return result;
};

// 8. Dynamic Department load stats derived selector with Module caching
let lastDeptIncidents: Incident[] | null = null;
let lastDeptStats: DepartmentIncidentStats[] = [];

export const selectDepartmentStats = (state: IncidentStore): DepartmentIncidentStats[] => {
  if (state.incidents === lastDeptIncidents) {
    return lastDeptStats;
  }

  const stats: Record<string, { incidents: number; resolved: number }> = {
    'Plant Operations': { incidents: 0, resolved: 0 },
    'Maintenance': { incidents: 0, resolved: 0 },
    'Electrical Zone': { incidents: 0, resolved: 0 },
    'LPG Yard': { incidents: 0, resolved: 0 }
  };

  state.incidents.forEach(inc => {
    const dept = inc.department || 'Plant Operations';
    if (!stats[dept]) {
      stats[dept] = { incidents: 0, resolved: 0 };
    }
    stats[dept].incidents += 1;
    if (inc.status === 'Resolved') {
      stats[dept].resolved += 1;
    }
  });

  const result = Object.entries(stats).map(([department, data]) => ({
    department,
    incidents: data.incidents,
    resolved: data.resolved
  }));

  lastDeptIncidents = state.incidents;
  lastDeptStats = result;
  return result;
};

// 9. Dynamic Severity stats derived selector with Module caching
let lastSeverityIncidents: Incident[] | null = null;
let lastSeverityStats: { name: string; value: number }[] = [];

export const selectSeverityStats = (state: IncidentStore) => {
  if (state.incidents === lastSeverityIncidents) {
    return lastSeverityStats;
  }

  const counts = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  state.incidents.forEach(inc => {
    if (counts[inc.severity] !== undefined) {
      counts[inc.severity] += 1;
    }
  });
  
  const result = [
    { name: 'Low Severity', value: counts.Low },
    { name: 'Medium Severity', value: counts.Medium },
    { name: 'High Severity', value: counts.High },
    { name: 'Critical Severity', value: counts.Critical }
  ];

  lastSeverityIncidents = state.incidents;
  lastSeverityStats = result;
  return result;
};

// 10. Split Focused Selectors for Plant A, B, and C
let lastTelemetryA: typeof DEFAULT_TELEMETRY | null = null;
let lastWorkersA: any[] | null = null;
let lastIncidentsA: Incident[] | null = null;
let lastSafetyRatingA: number | null = null;
let lastPlantAStats: any = null;

export const selectPlantAStats = (state: IncidentStore) => {
  const safetyRating = selectPlantSafetyRating(state);
  if (
    state.telemetry === lastTelemetryA &&
    state.workers === lastWorkersA &&
    state.incidents === lastIncidentsA &&
    safetyRating === lastSafetyRatingA &&
    lastPlantAStats
  ) {
    return lastPlantAStats;
  }

  const crewA = state.workers.filter(w => w.zone.includes('Control') || w.zone.includes('Distillation') || w.zone.includes('Plant A')).length;
  const hazardsA = state.incidents.filter(i => (i.location.includes('Distillation') || i.location.includes('Segment D') || i.location.includes('Plant A')) && i.status !== 'Resolved').length;
  
  const result = {
    safety: safetyRating,
    crew: crewA,
    hazards: hazardsA,
    name: 'Refinery Block A',
    details: `Active distillation segment operating at pressure ${state.telemetry.segmentDPressure} bar, temp ${state.telemetry.temperature}°C.`
  };

  lastTelemetryA = state.telemetry;
  lastWorkersA = state.workers;
  lastIncidentsA = state.incidents;
  lastSafetyRatingA = safetyRating;
  lastPlantAStats = result;
  return result;
};

let lastTelemetryB: typeof DEFAULT_TELEMETRY | null = null;
let lastWorkersB: any[] | null = null;
let lastIncidentsB: Incident[] | null = null;
let lastPermitsB: any[] | null = null;
let lastSafetyRatingB: number | null = null;
let lastPlantBStats: any = null;

export const selectPlantBStats = (state: IncidentStore) => {
  const safetyRating = selectPlantSafetyRating(state);
  if (
    state.telemetry === lastTelemetryB &&
    state.workers === lastWorkersB &&
    state.incidents === lastIncidentsB &&
    state.activePermits === lastPermitsB &&
    safetyRating === lastSafetyRatingB &&
    lastPlantBStats
  ) {
    return lastPlantBStats;
  }
  
  const crewB = state.workers.filter(w => w.zone.includes('LPG') || w.zone.includes('Storage') || w.zone.includes('Chemical')).length;
  const hazardsB = state.incidents.filter(i => (i.location.includes('LPG') || i.location.includes('Chemical') || i.location.includes('Area B')) && i.status !== 'Resolved').length;
  const safetyB = Math.max(10, safetyRating - (state.telemetry.gasLpgLEL > 5 ? Math.round(state.telemetry.gasLpgLEL * 1.5) : 0));

  const result = {
    safety: safetyB,
    crew: crewB,
    hazards: hazardsB,
    name: 'Chemical Storage Area B',
    details: `Containment manifold monitoring LEL levels at ${state.telemetry.gasLpgLEL}%. Active permits: ${state.activePermits.length}.`
  };

  lastTelemetryB = state.telemetry;
  lastWorkersB = state.workers;
  lastIncidentsB = state.incidents;
  lastPermitsB = state.activePermits;
  lastSafetyRatingB = safetyRating;
  lastPlantBStats = result;
  return result;
};

let lastWorkersC: any[] | null = null;
let lastIncidentsC: Incident[] | null = null;
let lastPlantCStats: any = null;

export const selectPlantCStats = (state: IncidentStore) => {
  if (
    state.workers === lastWorkersC &&
    state.incidents === lastIncidentsC &&
    lastPlantCStats
  ) {
    return lastPlantCStats;
  }
  
  const crewC = state.workers.filter(w => w.zone.includes('Packaging') || w.zone.includes('Logistics') || w.zone.includes('C')).length || 2;
  const hazardsC = state.incidents.filter(i => (i.location.includes('Packaging') || i.location.includes('Logistics') || i.location.includes('C')) && i.status !== 'Resolved').length;

  const result = {
    safety: 98,
    crew: crewC,
    hazards: hazardsC,
    name: 'Packaging and Logistics C',
    details: 'Nominal operational status. Secondary visual checks validated.'
  };

  lastWorkersC = state.workers;
  lastIncidentsC = state.incidents;
  lastPlantCStats = result;
  return result;
};

// 11. Dynamic Safety Briefing reports derived selector with Module caching
let lastBriefingsRecords: ComplianceRecord[] | null = null;
let lastBriefingsIncidents: Incident[] | null = null;
let lastBriefingsResult: ExecutiveReport[] = [];

export const selectSafetyBriefings = (state: IncidentStore): ExecutiveReport[] => {
  if (state.complianceRecords === lastBriefingsRecords && state.incidents === lastBriefingsIncidents) {
    return lastBriefingsResult;
  }
  
  const reports: ExecutiveReport[] = [];
  const currentYear = new Date().getFullYear();
  
  const oisdRecords = state.complianceRecords.filter(r => r.category === 'OISD');
  if (oisdRecords.length > 0) {
    const compliantCount = oisdRecords.filter(r => r.status === 'Compliant').length;
    reports.push({
      id: 'rep_oisd',
      name: 'Mid-Year Refinery Safety Audit (OISD)',
      date: `July ${currentYear}`,
      size: `${(oisdRecords.length * 1.4).toFixed(1)} MB`,
      description: `Compliance level: ${compliantCount}/${oisdRecords.length} standards verified.`
    });
  }

  if (state.incidents.length > 0) {
    const resolvedCount = state.incidents.filter(i => i.status === 'Resolved').length;
    reports.push({
      id: 'rep_incidents',
      name: 'Incident Log Summary Report (Q2)',
      date: `June ${currentYear}`,
      size: `${(state.incidents.length * 0.8 + 1.2).toFixed(1)} MB`,
      description: `Total inquiries: ${state.incidents.length} (${resolvedCount} resolved).`
    });
  }

  const dgmsRecords = state.complianceRecords.filter(r => r.category === 'DGMS');
  if (dgmsRecords.length > 0) {
    reports.push({
      id: 'rep_dgms',
      name: 'DGMS Gas Sensor Network Certification',
      date: `May ${currentYear}`,
      size: '1.5 MB',
      description: 'Telemetry calibrations and ESD integration logs.'
    });
  }

  lastBriefingsRecords = state.complianceRecords;
  lastBriefingsIncidents = state.incidents;
  lastBriefingsResult = reports;
  return reports;
};

// 12. Compliance checklist selector
export const selectComplianceChecklist = (recordId: string) => (state: IncidentStore) => {
  const record = state.complianceRecords.find(r => r.id === recordId);
  return record?.checklist || [];
};

// 13. Active alerts count selector
export const selectActiveAlertCount = (state: IncidentStore): number => {
  return state.alerts.length;
};

// 14. Dynamic incident-free cycle selector with Module caching
let lastFreeDaysIncidents: Incident[] | null = null;
let lastFreeDaysResult: { val: string; sub: string } | null = null;

export const selectIncidentFreeDays = (state: IncidentStore): { val: string; sub: string } => {
  if (state.incidents === lastFreeDaysIncidents && lastFreeDaysResult) {
    return lastFreeDaysResult;
  }
  
  if (state.incidents.length === 0) {
    const result = { val: '365 Days', sub: 'All sectors active' };
    lastFreeDaysIncidents = state.incidents;
    lastFreeDaysResult = result;
    return result;
  }
  
  const sorted = [...state.incidents].sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  const latestDate = new Date(sorted[0].reportedAt);
  const diffTime = Math.abs(new Date().getTime() - latestDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const result = { val: `${diffDays} Days`, sub: `Since last breach (${sorted[0].location})` };
  
  lastFreeDaysIncidents = state.incidents;
  lastFreeDaysResult = result;
  return result;
};

function generateMockDebate(location: string, severity: string) {
  const zone = location || 'Coke Oven Battery 1';
  const isExplosion = zone.toLowerCase().includes('coke') || zone.toLowerCase().includes('oven') || severity === 'Critical';
  const isAsphyxiation = zone.toLowerCase().includes('sinter') || severity === 'High';
  
  let riskProbability = 8;
  let prediction = "No immediate safety threats predicted. Plant operations nominal.";
  let factors = ["All Sensors Reporting Green", "Permits Audited & Compliant"];
  let debateTranscript: any[] = [];
  let finalConsensus = "All agents agree that parameters are currently within normal compliance thresholds.";
  let recommendations = ["Maintain standard safety patrol rounds."];

  if (isExplosion) {
    riskProbability = 96;
    prediction = "Explosion possible within 18 minutes.";
    factors = ["Methane Leakage Accumulation", "Active Spark-Producing Hot Work", "Atmospheric Ventilation Stagnation"];
    finalConsensus = "CRITICAL HAZARD DECLARED: Positive flammability slope overlaps with active Hot Work (welding) and valve maintenance under stagnant wind conditions. Immediate explosion risk.";
    recommendations = [
      "ENGAGE SIRENS: Evacuate Coke Oven Battery 1 immediately.",
      "HALT PERMITS: Revoke Hot Work permit PTW-HW-202 immediately.",
      "ISOLATE PROCESS: Close ESD valves upstream of maintenance segment."
    ];
    debateTranscript = [
      { agent_id: 'gas_agent', agent_name: 'Gas Sensor Monitoring Agent', role: 'IoT Telemetry Analysis', round: 1, message: 'Methane LFL has increased to 6.8%. The accumulation rate is positive. High flammability slope detected.', sentiment: 'critical' },
      { agent_id: 'maintenance_agent', agent_name: 'Maintenance Intelligence Agent', role: 'Valve/Asset Operations', round: 1, message: 'Maintenance is active on the valve line. Seals are currently unseated.', sentiment: 'warning' },
      { agent_id: 'permit_agent', agent_name: 'Permit Compliance Agent', role: 'Work Permit Auditor', round: 1, message: 'Permit PTW-HW-202 (Hot Work) is active for welding near the manifold deck. Spark hazard present.', sentiment: 'warning' },
      { agent_id: 'weather_agent', agent_name: 'Environmental Weather Agent', role: 'Micro-climate Monitor', round: 1, message: 'Wind speed has decreased to 1.8 m/s. Stagnant air pocket. Gas will not disperse naturally.', sentiment: 'warning' },
      { agent_id: 'cctv_agent', agent_name: 'CCTV Computer Vision Agent', role: 'Visual Security Analytics', round: 1, message: 'CCTV confirms two workers are on the manifold deck holding welding gear.', sentiment: 'warning' },
      { agent_id: 'gas_agent', agent_name: 'Gas Sensor Monitoring Agent', role: 'IoT Telemetry Analysis', round: 2, message: 'The methane leak is accelerating. Sparks from welding will exceed the Lower Flammable Limit ignition threshold.', sentiment: 'critical' },
      { agent_id: 'permit_agent', agent_name: 'Permit Compliance Agent', role: 'Work Permit Auditor', round: 2, message: 'Under OISD-STD-105 standards, hot work is strictly banned above 4% LFL. Critical breach!', sentiment: 'critical' },
      { agent_id: 'coordinator_agent', agent_name: 'Safety Coordinator Agent', role: 'Orchestration & Consensus', round: 3, message: 'Consensus: Methane rising + Active Welding + Stagnant Air. Risk Probability = 96%. Prediction: Explosion possible within 18 minutes. Triggering evacuation.', sentiment: 'critical' }
    ];
  } else if (isAsphyxiation) {
    riskProbability = 92;
    prediction = "Asphyxiation / unconsciousness possible within 6 minutes.";
    factors = ["Oxygen Depletion (<16%)", "Active Confined Space Permit", "Poor Ventilation"];
    finalConsensus = "CRITICAL HEALTH THREAT: Oxygen level has dropped to 15.8% inside the confined space. Standby watchperson is outside, but workers are inside without positive-pressure air hoses.";
    recommendations = [
      "RESCUE MISSION: Dispatch standby rescue team with breathing apparatus and lifeline harness.",
      "VENTILATE: Activate forced-draft ventilation fans immediately."
    ];
    debateTranscript = [
      { agent_id: 'gas_agent', agent_name: 'Gas Sensor Monitoring Agent', role: 'IoT Telemetry Analysis', round: 1, message: 'Oxygen concentration is down to 15.8% inside the Sinter Plant hopper.', sentiment: 'critical' },
      { agent_id: 'permit_agent', agent_name: 'Permit Compliance Agent', role: 'Work Permit Auditor', round: 1, message: 'Confined space permit PTW-CS-101 is active. Two engineers are inside for cleaning.', sentiment: 'warning' },
      { agent_id: 'cctv_agent', agent_name: 'CCTV Computer Vision Agent', role: 'Visual Security Analytics', round: 1, message: 'Workers are inside without positive-pressure air hoses.', sentiment: 'warning' },
      { agent_id: 'coordinator_agent', agent_name: 'Safety Coordinator Agent', role: 'Orchestration & Consensus', round: 3, message: 'Consensus: Oxygen is at 15.8%, workers trapped in confined space. Risk Probability = 92%. Prediction: Asphyxiation within 6 minutes.', sentiment: 'critical' }
    ];
  } else {
    debateTranscript = [
      { agent_id: 'gas_agent', agent_name: 'Gas Sensor Monitoring Agent', role: 'IoT Telemetry Analysis', round: 1, message: 'All gas parameters within statutory limits.', sentiment: 'nominal' },
      { agent_id: 'permit_agent', agent_name: 'Permit Compliance Agent', role: 'Work Permit Auditor', round: 1, message: 'No SIMOPs or scheduling conflicts.', sentiment: 'nominal' },
      { agent_id: 'coordinator_agent', agent_name: 'Safety Coordinator Agent', role: 'Orchestration & Consensus', round: 2, message: 'Consensus: Plant safe. Risk Probability = 4%.', sentiment: 'nominal' }
    ];
  }

  return {
    zone,
    timestamp: new Date().toISOString(),
    risk_probability: riskProbability,
    prediction,
    compound_factors: factors,
    debate_transcript: debateTranscript,
    final_consensus: finalConsensus,
    recommendations,
    weather_info: { wind_speed_m_s: 2.1, wind_direction: 'SSE', humidity: 75, ambient_temp_c: 32, ventilation_status: 'Stagnant' },
    mode: 'Local Simulation Preview'
  };
}
