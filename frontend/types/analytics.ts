export interface SafetyMetrics {
  safetyScore: number;
  activeWorkers: number;
  openIncidentsCount: number;
  compliancePercentage: number;
  lastAuditDate: string;
}

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

export interface SeverityStats {
  severity: string;
  value: number;
  color: string;
}

export interface ComplianceRecord {
  id: string;
  standardName: string;
  category: 'OISD' | 'DGMS' | 'Factory Act';
  status: 'Compliant' | 'Non-Compliant' | 'Pending Audit';
  lastAudited: string;
  score: number;
  inspector: string;
  criticalFindingsCount: number;
  checklist?: { id: string; text: string; checked: boolean }[];
}

export interface SafetyAlert {
  id: string;
  message: string;
  severity: 'Critical' | 'Warning' | 'Info';
  timestamp: string;
  department: string;
}
