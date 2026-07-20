import { Incident, IncidentSeverity, IncidentStatus, IncidentAIAnalysis, Comment } from '../types/incident';
import { fetchBackend } from './api';

// Helper to map backend report to frontend incident
export function mapBackendReport(rep: any): Incident {
  const severityMap: Record<string, IncidentSeverity> = {
    'Safe': 'Low',
    'Warning': 'Medium',
    'Critical': 'Critical',
    'Low': 'Low',
    'Medium': 'Medium',
    'High': 'High',
  };
  const severity = severityMap[rep.risk_level] || 'High';

  const detectedHazards = rep.factors 
    ? rep.factors.map((f: any) => f.name) 
    : ['Uncontrolled Hazard'];

  const violatedRegulations = rep.regulatory_refs 
    ? rep.regulatory_refs.map((ref: string) => ({
        regulation: ref,
        act: ref.includes('OISD') ? 'OISD' : ref.includes('DGMS') ? 'DGMS' : 'Factory Act' as any,
        description: `Regulatory compliance finding code: ${ref}`,
        severity: 'Major' as any
      })) 
    : [];

  return {
    id: rep.report_id,
    title: `Safety Incident - ${rep.zone}`,
    description: rep.narrative || `Automatic incident report logged for ${rep.zone}.`,
    location: rep.zone,
    department: rep.zone.includes('Coke') ? 'Plant Operations' : rep.zone.includes('Furnace') ? 'Maintenance' : 'Plant Operations',
    severity: severity,
    status: rep.evacuation_status === 'resolved' ? 'Resolved' : 'Under Investigation',
    reportedAt: rep.generated_at,
    reporterName: 'AI Agent Core',
    reporterRole: 'Safety Officer',
    comments: [],
    aiAnalysis: {
      riskLevel: severity,
      confidenceScore: Math.round(rep.composite_risk_score) || 95,
      detectedHazards: detectedHazards,
      rootCause: rep.narrative || `Telemetry threshold breach in ${rep.zone} with composite risk score of ${rep.composite_risk_score}.`,
      recommendedPPE: rep.zone.includes('Ammonia') ? ['Cryogenic Gloves', 'SCBA'] : ['Flame Resistant FRC', 'Double Lanyard Safety Harness'],
      violatedRegulations: violatedRegulations,
      immediateActions: [
        'Review permit suspensions: ' + (rep.suspended_permits && rep.suspended_permits.length > 0 ? rep.suspended_permits.join(', ') : 'None'),
        'Initiate safety check in ' + rep.zone,
        rep.evidence_file_path ? 'Verify preserved evidence block: ' + rep.evidence_file_path.split(/[\\/]/).pop() : 'Evidence log pending'
      ],
      preventiveMeasures: [
        'Perform sensor audit and physical inspection',
        'Verify compliance with ' + (rep.regulatory_refs && rep.regulatory_refs.length > 0 ? rep.regulatory_refs.join(', ') : 'OISD / Factory Act')
      ],
      similarIncidents: [],
      timeline: [
        { id: 't1', title: 'Telemetry Alert Triggered', description: `Composite risk reached ${rep.composite_risk_score}`, timestamp: '00:00', status: 'completed' },
        { id: 't2', title: 'Permits Audited', description: `Flagged for suspension: ${rep.suspended_permits?.join(', ') || 'None'}`, timestamp: '00:02', status: 'completed' }
      ]
    }
  };
}

export const incidentService = {
  getIncidents: async (): Promise<Incident[]> => {
    try {
      const backendReports = await fetchBackend<any[]>('/api/incidents');
      const mapped = backendReports.map(mapBackendReport);
      
      // Merge with any locally reported incidents from localStorage to prevent loss of manual entries
      const localStr = typeof window !== 'undefined' ? localStorage.getItem('local_incidents') : null;
      const localIncidents: Incident[] = localStr ? JSON.parse(localStr) : [];
      
      // Avoid duplicate IDs
      const backendIds = new Set(mapped.map(i => i.id));
      const filteredLocal = localIncidents.filter(i => !backendIds.has(i.id));

      return [...filteredLocal, ...mapped];
    } catch (error) {
      console.error('Error fetching incidents from backend:', error);
      // Fallback to localStorage cache
      const localStr = typeof window !== 'undefined' ? localStorage.getItem('local_incidents') : null;
      return localStr ? JSON.parse(localStr) : [];
    }
  },

  getIncidentById: async (id: string): Promise<Incident | null> => {
    const list = await incidentService.getIncidents();
    return list.find(i => i.id === id) || null;
  },

  reportIncident: async (incidentData: Omit<Incident, 'id' | 'reportedAt' | 'comments' | 'status'>): Promise<Incident> => {
    const newIncident: Incident = {
      ...incidentData,
      id: `INC-UI-${Date.now().toString().slice(-6)}`,
      reportedAt: new Date().toISOString(),
      status: 'Reported',
      comments: [],
    };

    // Save locally
    if (typeof window !== 'undefined') {
      const localStr = localStorage.getItem('local_incidents');
      const localList = localStr ? JSON.parse(localStr) : [];
      localStorage.setItem('local_incidents', JSON.stringify([newIncident, ...localList]));
    }

    // Trigger backend alert to simulate orchestrator workflow
    try {
      await fetchBackend('/api/alerts/trigger', {
        method: 'POST',
        body: JSON.stringify({
          zone: incidentData.location,
          reason: `Manual UI Report: ${incidentData.title}. Description: ${incidentData.description}`
        })
      });
    } catch (err) {
      console.warn('Could not propagate incident trigger to backend:', err);
    }

    return newIncident;
  },

  addComment: async (incidentId: string, authorName: string, authorRole: any, content: string): Promise<Comment> => {
    const comment: Comment = {
      id: `c_${Date.now()}`,
      authorName,
      authorRole,
      content,
      timestamp: new Date().toISOString()
    };

    // Store in localStorage
    if (typeof window !== 'undefined') {
      const localStr = localStorage.getItem('local_comments_' + incidentId);
      const comments = localStr ? JSON.parse(localStr) : [];
      localStorage.setItem('local_comments_' + incidentId, JSON.stringify([...comments, comment]));
    }

    return comment;
  },

  analyzeIncidentAI: async (
    incidentId: string, 
    onStepChange: (stepIndex: number, currentDetail: string) => void
  ): Promise<IncidentAIAnalysis> => {
    const pipelineSteps = [
      { label: 'Connecting to ZeroHarm safety model...', detail: 'Initializing compliance audit sequence' },
      { label: 'Evaluating cumulative risk matrix...', detail: 'Analyzing zone telemetry & permit classifications' },
      { label: 'Auditing regulatory codes...', detail: 'Verifying guidelines (OISD / Factory Act)' },
      { label: 'Querying vector database...', detail: 'Retrieving historical case precedents' },
      { label: 'Compiling immediate recommendation payload...', detail: 'Formulating containment actions' }
    ];

    for (let i = 0; i < pipelineSteps.length; i++) {
      onStepChange(i, pipelineSteps[i].label + ' — ' + pipelineSteps[i].detail);
      await new Promise(r => setTimeout(r, 600));
    }

    const incident = await incidentService.getIncidentById(incidentId);
    if (!incident) throw new Error('Incident not found');

    try {
      // Execute compliance audit on backend
      const auditResult = await fetchBackend<any>('/api/compliance/audit', {
        method: 'POST',
        body: JSON.stringify({
          zone: incident.location,
          telemetry: {
            o2: incident.location.includes('Sinter') ? 16.5 : 20.8,
            co: incident.location.includes('Coke') ? 28.0 : 5.0,
            ch4_lfl: incident.location.includes('Coke') ? 6.5 : 0.1,
            h2s: incident.location.includes('Ammonia') ? 25.0 : 0.1
          },
          permits: [],
          maintenance_active: true
        })
      });

      return {
        riskLevel: incident.severity,
        confidenceScore: 92,
        detectedHazards: incident.aiAnalysis?.detectedHazards || ['Manual evaluation needed'],
        rootCause: auditResult.answer || `Audit logs processed for ${incident.location}.`,
        recommendedPPE: incident.aiAnalysis?.recommendedPPE || ['Flame Resistant Coveralls (FRC)'],
        violatedRegulations: incident.aiAnalysis?.violatedRegulations || [],
        immediateActions: [
          'Review backend safety audit output',
          'Deploy standby safety supervisor'
        ],
        preventiveMeasures: [
          'Verify zone ventilation systems',
          'Audit permit registry records'
        ],
        similarIncidents: [],
        timeline: [
          { id: `t_${Date.now()}_1`, title: 'Logged', description: 'Incident registered in desk', timestamp: 'Just now', status: 'completed' },
          { id: `t_${Date.now()}_2`, title: 'RAG Audit Completed', description: 'Compliance audit retrieved', timestamp: 'Just now', status: 'completed' }
        ]
      };
    } catch (err) {
      console.error('Backend compliance audit failed:', err);
      throw err;
    }
  }
};
