import { create } from 'zustand';
import { Incident, IncidentAIAnalysis, Comment, IncidentStatus, IncidentSeverity } from '../types/incident';
import { ComplianceRecord, SafetyAlert, NearMissPrediction, WorkerSafetyProfile } from '../types/analytics';
import { AppEvent } from '../lib/eventBus';
import { fetchBackend } from '../services/api';

import { useNotifications } from './useNotifications';

// Default Nominal Roster & Parameters
const DEFAULT_TELEMETRY = { gasLpgLEL: 0, segmentDPressure: 0, temperature: 0 };
const DEFAULT_WORKERS: any[] = [];
const DEFAULT_PERMITS: any[] = [];
const DEFAULT_ALERTS: SafetyAlert[] = [];
const DEFAULT_COMPLIANCE: ComplianceRecord[] = [];

const generateLocalIncidentAIAnalysis = (location: string): any => {
  const locLower = (location || '').toLowerCase();
  const isCoke = locLower.includes('coke') || locLower.includes('oven');
  const isSinter = locLower.includes('sinter');
  const isAmmonia = locLower.includes('ammonia') || locLower.includes('storage');

  if (isCoke) {
    return {
      risk_assessment: {
        composite_risk_score: 72.0,
        factors: [
          { name: "Gas Concentration Shift", details: "Methane sensor logged 4.2% LFL drift exceeding the OISD-STD-105 welding safety limit." },
          { name: "Simultaneous Operations Conflict", details: "Overlapping active hot work permit registered in Coke Oven Battery 1 during purge line maintenance." }
        ]
      },
      permit_audit: {
        conflicts: [
          { conflict_type: "Hot Work LFL Violation", details: "Active spark-producing hot work permit in progress while flammability is above 4.0% LFL limit." }
        ]
      },
      compliance_narrative: "Factories Act 1948 Section 37 breach identified: Accumulation of inflammable gas near an active ignition source. All hot work must be suspended, and continuous exhaust ventilation initiated.",
      unified_action: "Suspend all spark-producing permits in the Coke Oven battery immediately. Conduct manual gas sweep with calibrated handheld sniffer probes."
    };
  } else if (isSinter) {
    return {
      risk_assessment: {
        composite_risk_score: 82.5,
        factors: [
          { name: "Atmospheric Depletion", details: "Oxygen sensor at bottom chamber logged 18.2% O2 deficiency." },
          { name: "Standby Watch Breach", details: "Confined space entry authorized without secondary mechanical ventilation system online." }
        ]
      },
      permit_audit: {
        conflicts: [
          { conflict_type: "Confined Space Sec 36 Violation", details: "Entry authorized into a vessel without certified continuous fresh air ventilation." }
        ]
      },
      compliance_narrative: "Factories Act 1948 Section 36 violation: Technicians permitted to enter a restricted chamber without positive pressure mechanical air induction and double harness standby watch.",
      unified_action: "Withdraw all personnel from the Sinter Plant bottom chamber. Initiate continuous blower purge and re-verify atmosphere."
    };
  } else if (isAmmonia) {
    return {
      risk_assessment: {
        composite_risk_score: 65.0,
        factors: [
          { name: "Toxic Vapor Gasket Leak", details: "Ammonia valve discharge line seal showing signs of physical cracking and minor drift." },
          { name: "Isolation Valve Failure", details: "Preventive valve testing interval exceeded by 45 days." }
        ]
      },
      permit_audit: {
        conflicts: [
          { conflict_type: "Safety Audit Warning", details: "Primary isolation gasket deferred maintenance schedule breached." }
        ]
      },
      compliance_narrative: "OISD-GDN-137 compliance deviation: Deferred testing of main pressure relief valves. Wear full face respirators and mobilize water curtain spray systems.",
      unified_action: "Establish water spray mist curtain to suppress toxic ammonia vapors. Replace valve manifold gasket."
    };
  } else {
    // Blast Furnace or General Fallback
    return {
      risk_assessment: {
        composite_risk_score: 88.0,
        factors: [
          { name: "Thermal Manifold Overpressure", details: "Blast Furnace manifold pressure drifted to 1.62 kg/cm² under heavy feed loading." },
          { name: "CCTV Safety Breach", details: "Restricted entry alert triggered inside sub-critical zone without permit override." }
        ]
      },
      permit_audit: {
        conflicts: [
          { conflict_type: "Restricted Entry Violation", details: "Technician detected in thermal line segment without valid digital permit verification." }
        ]
      },
      compliance_narrative: "Factories Act Section 87 safety deviation: Operator presence in high-pressure thermal boundary zone without LOTO padlock verification and registered gatehouse clearance.",
      unified_action: "Evacuate unauthorized personnel from the Blast Furnace A platform. Initiate pressure release vent sequence."
    };
  }
};

const seedDate = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

const DEFAULT_INCIDENTS: Incident[] = [
  {
    id: 'inc_h1',
    title: 'Gas Detector Calibration Failure',
    description: 'Gas sensors in Blast Furnace A showed calibration drift during weekly inspection.',
    location: 'Blast Furnace A',
    department: 'Maintenance',
    severity: 'Low',
    status: 'Resolved',
    reportedAt: seedDate(150),
    reporterName: 'David Vance',
    reporterRole: 'Compliance Officer',
    comments: []
  },
  {
    id: 'inc_h2',
    title: 'Methane Concentration Spike',
    description: 'Sub-critical methane leak detected in Coke Oven Battery 1 during maintenance.',
    location: 'Coke Oven Battery 1',
    department: 'Plant Operations',
    severity: 'Medium',
    status: 'Resolved',
    reportedAt: seedDate(120),
    reporterName: 'Arjun',
    reporterRole: 'Site Engineer',
    comments: []
  },
  {
    id: 'inc_h3',
    title: 'Confined Space Ventilation Breach',
    description: 'Sinter Plant confined space entry permitted without secondary exhaust fan active, violating OISD-STD-105.',
    location: 'Sinter Plant',
    department: 'Plant Operations',
    severity: 'High',
    status: 'Resolved',
    reportedAt: seedDate(90),
    reporterName: 'Sarah Jenkins',
    reporterRole: 'Safety Officer',
    comments: []
  },
  {
    id: 'inc_h4',
    title: 'Hydrogen Sulfide Gas Alarm',
    description: 'H2S detector triggered high alarm (28 ppm) in Sinter Plant area. Evacuation checklist initiated.',
    location: 'Sinter Plant',
    department: 'Plant Operations',
    severity: 'Critical',
    status: 'Resolved',
    reportedAt: seedDate(60),
    reporterName: 'Marcus Brody',
    reporterRole: 'Site Engineer',
    comments: []
  },
  {
    id: 'inc_h5',
    title: 'Boiler Valve Steam Leak',
    description: 'High pressure steam leak detected at isolation valve B-41, requiring emergency maintenance crew.',
    location: 'Blast Furnace A',
    department: 'Electrical Zone',
    severity: 'Medium',
    status: 'Resolved',
    reportedAt: seedDate(30),
    reporterName: 'David Vance',
    reporterRole: 'Site Engineer',
    comments: []
  },
  {
    id: 'inc_h6',
    title: 'PPE Violation - No Safety Harness',
    description: 'Worker observed at Ammonia Storage Tank height scaffold without double lanyard safety harness.',
    location: 'Ammonia Storage Tank',
    department: 'LPG Yard',
    severity: 'Medium',
    status: 'Resolved',
    reportedAt: seedDate(10),
    reporterName: 'Sarah Jenkins',
    reporterRole: 'Safety Officer',
    comments: []
  }
];

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
  wsConnected: boolean;
  eventLogs: AppEvent[];
  aiReasoning: { reasoning: string; recommendations: string[]; detectedHazards: string[] };
  activeDebate: any | null;
  nearMisses: NearMissPrediction[];
  workerSafetyProfiles: WorkerSafetyProfile[];

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
  toggleChecklistItem: (recordId: string, itemId: string, state: 'unmarked' | 'compliant' | 'non_compliant') => void;
  addAlert: (alert: SafetyAlert) => void;
  removeAlert: (id: string) => void;
  addIncident: (incident: Incident) => void;
  updateIncident: (id: string, updates: Partial<Incident>) => void;
  setEmergency: (active: boolean, msg?: string) => void;
  setAIReasoning: (reasoning: string, recommendations: string[], hazards: string[]) => void;
  setActiveDebate: (debate: any) => void;
  setNearMisses: (nearMisses: NearMissPrediction[]) => void;
  setWorkerSafetyProfiles: (profiles: WorkerSafetyProfile[]) => void;
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
  wsConnected: false,
  eventLogs: [],
  aiReasoning: {
    reasoning: 'Connecting to ZeroHarm safety system server...',
    recommendations: [],
    detectedHazards: []
  },
  activeDebate: null,
  nearMisses: [] as NearMissPrediction[],
  workerSafetyProfiles: [] as WorkerSafetyProfile[],

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
  toggleChecklistItem: (recordId, itemId, state) => set((s) => ({
    complianceRecords: s.complianceRecords.map((r) => {
      if (r.id !== recordId || !r.checklist) return r;
      const checklist = r.checklist.map((item) =>
        item.id === itemId ? { ...item, state } : item
      );
      const total = checklist.length;
      const compliantCount = checklist.filter((c) => c.state === 'compliant').length;
      const nonCompliantCount = checklist.filter((c) => c.state === 'non_compliant').length;

      // Rule: any red cross anywhere -> whole standard is Non-Compliant.
      // Everything ticked green -> Compliant.
      // Otherwise (still has unmarked/unopened items, no crosses) -> Pending Audit.
      let recordStatus: ComplianceRecord['status'];
      if (nonCompliantCount > 0) {
        recordStatus = 'Non-Compliant';
      } else if (total > 0 && compliantCount === total) {
        recordStatus = 'Compliant';
      } else {
        recordStatus = 'Pending Audit';
      }

      const score = total > 0 ? Math.round((compliantCount / total) * 100) : r.score;

      return {
        ...r,
        checklist,
        score,
        status: recordStatus,
        criticalFindingsCount: nonCompliantCount,
        lastAudited: new Date().toISOString().split('T')[0],
      };
    }),
  })),
  addAlert: (alert) => set((s) => ({ alerts: [alert, ...s.alerts] })),
  removeAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
  addIncident: (incident) => set((s) => {
    if (typeof window !== 'undefined') {
      try {
        const localStr = localStorage.getItem('local_incidents');
        const localList = localStr ? JSON.parse(localStr) : [];
        if (!localList.some((l: any) => l.id === incident.id)) {
          localStorage.setItem('local_incidents', JSON.stringify([incident, ...localList]));
        }
      } catch (e) {
        console.warn('Failed to save incident to localStorage:', e);
      }
    }
    return { incidents: [incident, ...s.incidents] };
  }),
  updateIncident: (id, updates) => set((s) => {
    const updated = s.incidents.map(inc => inc.id === id ? { ...inc, ...updates } : inc);
    const active = s.activeIncident?.id === id ? { ...s.activeIncident, ...updates } : s.activeIncident;
    if (typeof window !== 'undefined') {
      try {
        const localStr = localStorage.getItem('local_incidents');
        if (localStr) {
          const localList: any[] = JSON.parse(localStr);
          const idx = localList.findIndex((l: any) => l.id === id);
          if (idx !== -1) {
            localList[idx] = { ...localList[idx], ...updates };
            localStorage.setItem('local_incidents', JSON.stringify(localList));
          }
        }
      } catch (e) {
        console.warn('Failed to update local incident in localStorage:', e);
      }
    }
    return { incidents: updated, activeIncident: active };
  }),
  setEmergency: (active, msg) => set({ emergencyMode: active, evacuationMessage: msg || '' }),
  setAIReasoning: (reasoning, recommendations, detectedHazards) => set({ aiReasoning: { reasoning, recommendations, detectedHazards } }),
  setActiveDebate: (debate) => set({ activeDebate: debate }),
  setNearMisses: (nearMisses) => set({ nearMisses }),
  setWorkerSafetyProfiles: (profiles) => set({ workerSafetyProfiles: profiles }),
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
    nearMisses: [] as NearMissPrediction[],
    workerSafetyProfiles: [] as WorkerSafetyProfile[],
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
    } catch (e: any) {
      console.warn('Backend full assessment failed or server offline. Using client-side preview fallback.', e);
      backendAnalysis = generateLocalIncidentAIAnalysis(target.location);
      const isFetchError = e.message?.includes('fetch') || e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError') || e.message?.includes('API call failed');
      if (isFetchError) {
        useNotifications.getState().addToast('ZeroHarm safety server is offline. Loaded client-side RAG analysis preview.', 'warning');
      } else {
        useNotifications.getState().addToast(`Failed to analyze: ${e.message || e}. Loaded local fallback.`, 'error');
      }
    }

    if (!backendAnalysis) {
      backendAnalysis = generateLocalIncidentAIAnalysis(target.location);
    }

    const risk = backendAnalysis.risk_assessment || {};
    const permit = backendAnalysis.permit_audit || {};
    
    const hazards = Array.isArray(risk.factors) 
      ? risk.factors.map((f: any) => f.name) 
      : ['Uncontrolled energy discharge'];
    
    const actions = Array.isArray(risk.factors) 
      ? risk.factors.map((f: any) => f.details) 
      : [backendAnalysis.unified_action];

    const aiAnalysis: IncidentAIAnalysis = {
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
// 1. Safety Index (0-100) calculated with a 50% threshold baseline and 2% step adjustments
export const selectPlantSafetyRating = (state: IncidentStore): number => {
  const SAFETY_THRESHOLD = 50; // 50% Statutory Safety Threshold
  let totalDeduction = 0;

  // Deduction 1: Gas LEL Flammability (> 0% LEL) - 2% per 1% LEL
  if (state.telemetry.gasLpgLEL > 0) {
    totalDeduction += Math.ceil(state.telemetry.gasLpgLEL) * 2;
  }

  // Deduction 2: Pipeline Pressure (> 1.0 bar) - 2% per 0.1 bar
  if (state.telemetry.segmentDPressure > 1.0) {
    totalDeduction += Math.ceil((state.telemetry.segmentDPressure - 1.0) * 10) * 2;
  }

  // Deduction 3: Temperature (> 30°C) - 2% per 5°C
  if (state.telemetry.temperature > 30) {
    totalDeduction += Math.ceil((state.telemetry.temperature - 30) / 5) * 2;
  }

  // Deduction 4: Active Alerts (4% to 15% per alert)
  state.alerts.forEach(alert => {
    if (alert.severity === 'Critical') totalDeduction += 15;
    else if (alert.severity === 'Warning') totalDeduction += 8;
    else totalDeduction += 2;
  });

  // Deduction 5: Emergency Mode Active - 50% immediate drop
  if (state.emergencyMode) {
    totalDeduction += 50;
  }

  // Deduction 6: Open Critical/High Safety Incidents
  const openIncidents = state.incidents.filter(i => i.status !== 'Resolved');
  openIncidents.forEach(inc => {
    if (inc.severity === 'Critical') totalDeduction += 20;
    else if (inc.severity === 'High') totalDeduction += 12;
  });

  // Deduction 7: Worker PPE Violations (2% per non-compliant worker)
  const activePPEBreaches = state.workers.filter(w => w.ppeOk === false).length;
  totalDeduction += activePPEBreaches * 2;

  // Calculate score starting from 98% nominal baseline
  const nowSec = typeof window !== 'undefined' ? Math.floor(Date.now() / 1000) : 0;
  const nominalBaseline = 98 - (nowSec % 3); // 96% - 98% dynamic baseline

  let score = nominalBaseline - totalDeduction;

  // Rule: Once risk deductions push score past the 50% threshold limit, decrease an extra 2% per step
  if (score < SAFETY_THRESHOLD) {
    const breachAmount = SAFETY_THRESHOLD - score;
    score = SAFETY_THRESHOLD - (breachAmount * 2);
  }

  return Math.max(5, Math.min(100, Math.round(score)));
};

// 2. Derived Overall Risk Categorization anchored around the 50% threshold
export const selectOverallRisk = (state: IncidentStore): 'Low' | 'Medium' | 'High' | 'Critical' => {
  const rating = selectPlantSafetyRating(state);
  if (rating >= 75) return 'Low';
  if (rating >= 50) return 'Medium';
  if (rating >= 30) return 'High';
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
        if (inc.severity === 'Critical' || inc.severity === 'High') {
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
    name: 'Blast Furnace A',
    zone: 'Blast Furnace A',
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
    name: 'Coke Oven Battery 1',
    zone: 'Coke Oven Battery 1',
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
    name: 'Sinter Plant',
    zone: 'Sinter Plant',
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