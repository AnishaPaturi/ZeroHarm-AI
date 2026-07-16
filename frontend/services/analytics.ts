import { SafetyMetrics, MonthlyIncidentCount, DepartmentIncidentStats, ComplianceRecord, SafetyAlert } from '../types/analytics';

const MOCK_METRICS: SafetyMetrics = {
  safetyScore: 94,
  activeWorkers: 342,
  openIncidentsCount: 3,
  compliancePercentage: 97.4,
  lastAuditDate: '2026-07-10'
};

const MOCK_MONTHLY: MonthlyIncidentCount[] = [
  { month: 'Jan', incidents: 4, critical: 0 },
  { month: 'Feb', incidents: 3, critical: 1 },
  { month: 'Mar', incidents: 5, critical: 0 },
  { month: 'Apr', incidents: 2, critical: 1 },
  { month: 'May', incidents: 6, critical: 2 },
  { month: 'Jun', incidents: 1, critical: 0 },
  { month: 'Jul', incidents: 3, critical: 1 }
];

const MOCK_DEPARTMENTS: DepartmentIncidentStats[] = [
  { department: 'Plant Operations', incidents: 12, resolved: 10 },
  { department: 'Maintenance', incidents: 8, resolved: 8 },
  { department: 'Electrical Zone', incidents: 4, resolved: 3 },
  { department: 'LPG Yard', incidents: 2, resolved: 1 }
];

const MOCK_COMPLIANCE: ComplianceRecord[] = [
  {
    id: 'comp_1',
    standardName: 'OISD-STD-150 (Vessels Pressure Testing)',
    category: 'OISD',
    status: 'Compliant',
    lastAudited: '2026-07-02',
    score: 98,
    inspector: 'Marcus Brody',
    criticalFindingsCount: 0
  },
  {
    id: 'comp_2',
    standardName: 'DGMS Circular 14 (Gas Telemetry Links)',
    category: 'DGMS',
    status: 'Non-Compliant',
    lastAudited: '2026-07-16',
    score: 72,
    inspector: 'Sarah Jenkins',
    criticalFindingsCount: 1
  },
  {
    id: 'comp_3',
    standardName: 'Factory Act Sec 21 (Gearing Guardrails)',
    category: 'Factory Act',
    status: 'Compliant',
    lastAudited: '2026-06-15',
    score: 95,
    inspector: 'Marcus Brody',
    criticalFindingsCount: 0
  },
  {
    id: 'comp_4',
    standardName: 'OISD-STD-105 (Emergency Drill Register)',
    category: 'OISD',
    status: 'Pending Audit',
    lastAudited: '2026-07-17',
    score: 0,
    inspector: 'Sarah Jenkins',
    criticalFindingsCount: 0
  }
];

const MOCK_ALERTS: SafetyAlert[] = [
  {
    id: 'a_1',
    message: 'Hydrocarbon levels elevated near LPG unloading manifolds.',
    severity: 'Critical',
    timestamp: '2026-07-16T18:45:00Z',
    department: 'LPG Yard'
  },
  {
    id: 'a_2',
    message: 'High wind warnings (exceeding 45 km/h). Suspend all tower crane operations.',
    severity: 'Warning',
    timestamp: '2026-07-17T02:00:00Z',
    department: 'Site Lifting Operations'
  },
  {
    id: 'a_3',
    message: 'Refinery distillation area scheduled audit notification generated.',
    severity: 'Info',
    timestamp: '2026-07-17T01:30:00Z',
    department: 'Plant Operations'
  }
];

export const analyticsService = {
  getMetrics: async (): Promise<SafetyMetrics> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ ...MOCK_METRICS });
      }, 400);
    });
  },

  getMonthlyIncidents: async (): Promise<MonthlyIncidentCount[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([...MOCK_MONTHLY]);
      }, 300);
    });
  },

  getDepartmentStats: async (): Promise<DepartmentIncidentStats[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([...MOCK_DEPARTMENTS]);
      }, 300);
    });
  },

  getComplianceRecords: async (): Promise<ComplianceRecord[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([...MOCK_COMPLIANCE]);
      }, 400);
    });
  },

  getSafetyAlerts: async (): Promise<SafetyAlert[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([...MOCK_ALERTS]);
      }, 250);
    });
  }
};
