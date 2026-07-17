import { UserRole } from './user';

export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type IncidentStatus = 'Reported' | 'Under Investigation' | 'RCA Complete' | 'Resolved';

export interface Comment {
  id: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  timestamp: string;
}

export interface ViolatedRegulation {
  regulation: string;
  act: 'OISD' | 'DGMS' | 'Factory Act';
  description: string;
  severity: 'Major' | 'Minor';
}

export interface SimilarIncident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  similarity: number; // percentage
  date: string;
}

export interface IncidentTimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  status: 'completed' | 'current' | 'pending';
}

export interface IncidentAIAnalysis {
  riskLevel: IncidentSeverity;
  confidenceScore: number; // 0 to 100
  detectedHazards: string[];
  rootCause: string;
  recommendedPPE: string[];
  violatedRegulations: ViolatedRegulation[];
  immediateActions: string[];
  preventiveMeasures: string[];
  similarIncidents: SimilarIncident[];
  timeline: IncidentTimelineEvent[];
  collaborativeDebate?: any;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  location: string;
  department: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  reportedAt: string;
  reporterName: string;
  reporterRole: UserRole;
  mediaUrls?: string[];
  documentUrls?: string[];
  comments: Comment[];
  aiAnalysis?: IncidentAIAnalysis;
}
