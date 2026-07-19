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

export interface NearMissPrediction {
  zone: string;
  prediction_timestamp: string;
  predicted_incident_probability: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  prediction_horizon: string;
  prediction: string;
  root_causes: string[];
  recommendations: string[];
  confidence_score: number;
  trend: 'escalating' | 'stable' | 'nominal';
  entry_count: number;
  unique_workers_identified: number;
  recent_workers: string[];
  history: any[];
  factors: {
    frequency_score: number;
    acceleration_score: number;
    environmental_score: number;
    worker_pattern_score: number;
    time_risk_score: number;
  };
}

export interface SafetyAlert {
  id: string;
  message: string;
  severity: 'Critical' | 'Warning' | 'Info';
  timestamp: string;
  department: string;
}
