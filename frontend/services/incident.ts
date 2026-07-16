import { Incident, IncidentSeverity, IncidentStatus, IncidentAIAnalysis, Comment } from '../types/incident';

const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'inc_1',
    title: 'Pressure Release Valve Over-pressurization',
    description: 'Pressure surge in the primary distillation column pipeline (Segment D-4) reached 14.2 bar, exceeding the maximum safe rating of 11.5 bar. The relief valve failed to actuate automatically, requiring manual override by the control operator.',
    location: 'Segment D-4, Distillation Unit A',
    department: 'Plant Operations',
    severity: 'High',
    status: 'RCA Complete',
    reportedAt: '2026-07-16T10:15:00Z',
    reporterName: 'Sarah Jenkins',
    reporterRole: 'Safety Officer',
    mediaUrls: [],
    comments: [
      {
        id: 'c_1',
        authorName: 'David Vance',
        authorRole: 'Plant Manager',
        content: 'I have ordered a physical check of the telemetry cables. Telemetry showed no alerts prior to the surge.',
        timestamp: '2026-07-16T11:00:00Z'
      }
    ],
    aiAnalysis: {
      riskLevel: 'High',
      confidenceScore: 94,
      detectedHazards: ['Pipeline Pressure Surge', 'Mechanical Valve Failure', 'Thermal Exposure Risk'],
      rootCause: 'Mechanical fatigue of the valve compression spring, coupled with a telemetry feedback delay from the pressure transmitter.',
      recommendedPPE: ['Flame Resistant Clothing (FRC)', 'Pressure-rated Face Shield', 'Double Hearing Protection'],
      violatedRegulations: [
        {
          regulation: 'OISD-STD-150 Sec 5.3',
          act: 'OISD',
          description: 'Relief valve mechanical assemblies must be pressure-tested and certified every 12 months.',
          severity: 'Major'
        }
      ],
      immediateActions: [
        'Isolate feed Segment D-4',
        'Trigger manual flare header diversion',
        'Deploy mobile pressure-monitoring squad'
      ],
      preventiveMeasures: [
        'Upgrade pressure transmitters to dual-channel redundant sensors',
        'Decrease relief valve testing cycles to 6 months in Distillation Area',
        'Replace relief valve compression spring assembly'
      ],
      similarIncidents: [
        { id: 'inc_old_1', title: 'Flare manifold block overpressure', severity: 'High', similarity: 82, date: '2025-11-12' }
      ],
      timeline: [
        { id: 't_1', title: 'Incident Reported', description: 'Logged by Safety Officer', timestamp: '10:15', status: 'completed' },
        { id: 't_2', title: 'Containment Action', description: 'Manual venting initiated', timestamp: '10:20', status: 'completed' },
        { id: 't_3', title: 'AI Audit Completed', description: 'Compliance scanned against OISD', timestamp: '10:22', status: 'completed' },
        { id: 't_4', title: 'Maintenance Overhaul', description: 'Spring assembly replaced', timestamp: '14:30', status: 'completed' }
      ]
    }
  },
  {
    id: 'inc_2',
    title: 'Gas Leak Detected near LPG Manifold',
    description: 'Hydrocarbon detector HC-104 triggered warning of 18% LEL concentration near the LPG unloading manifold. Handheld sniffer tests confirmed propane leak at the main flange gasket.',
    location: 'Unloading Bay 3, LPG Yard',
    department: 'Plant Operations',
    severity: 'Critical',
    status: 'Under Investigation',
    reportedAt: '2026-07-16T18:45:00Z',
    reporterName: 'John Doe',
    reporterRole: 'Site Engineer',
    mediaUrls: [],
    comments: [],
    aiAnalysis: {
      riskLevel: 'Critical',
      confidenceScore: 98,
      detectedHazards: ['Flammable Vapor Cloud', 'Explosion Hazard', 'Cold Burn Hazard'],
      rootCause: 'Elastomer flange gasket degradation due to thermal shock during cryogenic liquefied gas transfer.',
      recommendedPPE: ['Cryogenic Safety Gloves', 'Self-Contained Breathing Apparatus (SCBA)', 'Anti-static Protective Clothing'],
      violatedRegulations: [
        {
          regulation: 'DGMS Circular 14 Sec 2',
          act: 'DGMS',
          description: 'Hydrocarbon sensor nodes must be linked directly to emergency plant shutdown (ESD) circuits.',
          severity: 'Major'
        }
      ],
      immediateActions: [
        'Engage automatic ESD loop to isolate unloading lines',
        'Deploy water deluge wall to disperse vapor cloud',
        'Shut down electrical circuits in Zone 1 boundary'
      ],
      preventiveMeasures: [
        'Replace standard elastomer gaskets with spiral-wound stainless gaskets',
        'Add thermal imaging cameras over the unloading manifolds'
      ],
      similarIncidents: [
        { id: 'inc_old_2', title: 'Unloading joint leak at Tank 12', severity: 'Critical', similarity: 91, date: '2025-04-20' }
      ],
      timeline: [
        { id: 't_1', title: 'Sensor Triggered', description: 'HC-104 detected high LEL', timestamp: '18:45', status: 'completed' },
        { id: 't_2', title: 'ESD Triggered', description: 'Valves closed automatically', timestamp: '18:46', status: 'completed' },
        { id: 't_3', title: 'Venting & Deluge', description: 'Water deluge wall active', timestamp: '18:50', status: 'completed' },
        { id: 't_4', title: 'RCA Diagnosis', description: 'AI investigating gasket logs', timestamp: '19:10', status: 'current' }
      ]
    }
  }
];

// In-memory array that acts as our database
let incidentsDb = [...MOCK_INCIDENTS];

export const incidentService = {
  getIncidents: async (): Promise<Incident[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([...incidentsDb]);
      }, 500);
    });
  },

  getIncidentById: async (id: string): Promise<Incident | null> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const item = incidentsDb.find(i => i.id === id) || null;
        resolve(item);
      }, 300);
    });
  },

  reportIncident: async (incidentData: Omit<Incident, 'id' | 'reportedAt' | 'comments' | 'status'>): Promise<Incident> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newIncident: Incident = {
          ...incidentData,
          id: `inc_${Date.now()}`,
          reportedAt: new Date().toISOString(),
          status: 'Reported',
          comments: [],
        };
        incidentsDb = [newIncident, ...incidentsDb];
        resolve(newIncident);
      }, 1000);
    });
  },

  addComment: async (incidentId: string, authorName: string, authorRole: any, content: string): Promise<Comment> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const incident = incidentsDb.find(i => i.id === incidentId);
        if (!incident) {
          reject(new Error('Incident not found'));
          return;
        }
        const comment: Comment = {
          id: `c_${Date.now()}`,
          authorName,
          authorRole,
          content,
          timestamp: new Date().toISOString()
        };
        incident.comments.push(comment);
        resolve(comment);
      }, 400);
    });
  },

  // Generates AI analysis progressively for a given incident
  analyzeIncidentAI: async (
    incidentId: string, 
    onStepChange: (stepIndex: number, currentDetail: string) => void
  ): Promise<IncidentAIAnalysis> => {
    const pipelineSteps = [
      { label: 'Detecting physical hazards...', detail: 'Scanning report text & attachments for hazardous variables' },
      { label: 'Extracting evidence metadata...', detail: 'Validating logs, sensor inputs, and weather/plant stats' },
      { label: 'Evaluating cumulative risk matrix...', detail: 'Calculating potential severity and likelihood levels' },
      { label: 'Auditing regulatory codes...', detail: 'Checking standard books (OISD, DGMS, Factory Act)' },
      { label: 'Cross-referencing historical database...', detail: 'Querying historical logs for matching root causes' },
      { label: 'Calibrating confidence score...', detail: 'Synthesizing inputs and generating certainty rating' },
      { label: 'Formulating actions and recommendations...', detail: 'Generating protective guidelines and PPE checklists' }
    ];

    for (let i = 0; i < pipelineSteps.length; i++) {
      onStepChange(i, pipelineSteps[i].label + ' — ' + pipelineSteps[i].detail);
      await new Promise(r => setTimeout(r, 800)); // simulation duration per stage
    }

    const incident = incidentsDb.find(i => i.id === incidentId);
    if (!incident) throw new Error('Incident not found');

    const mockAnalysis: IncidentAIAnalysis = {
      riskLevel: incident.severity,
      confidenceScore: Math.floor(Math.random() * 15) + 82, // 82 - 97
      detectedHazards: ['Uncontrolled energy discharge', 'Operational oversight', 'Critical structural wear'],
      rootCause: `Operational stress exceeding standard tolerance limits of ${incident.location}, compounded by delayed sensor response loop.`,
      recommendedPPE: ['High-visibility impact vest', 'Intrinsically safe personal torch', 'ANSI-certified steel-toed protection'],
      violatedRegulations: [
        {
          regulation: 'Factory Act Section 21',
          act: 'Factory Act',
          description: 'Secure guarding of machinery is mandatory in active zones.',
          severity: 'Minor'
        },
        {
          regulation: 'OISD-STD-105 Sec 4.2',
          act: 'OISD',
          description: 'Emergency response drill registers must be maintained.',
          severity: 'Minor'
        }
      ],
      immediateActions: [
        'Conduct gas sniffer patrol around perimeter',
        'Verify valve isolations',
        'Initiate safety stand-down briefing'
      ],
      preventiveMeasures: [
        'Upgrade mechanical warning relays',
        'Re-train crew on segment handling standards'
      ],
      similarIncidents: [
        { id: 'inc_1', title: 'Pressure Release Valve Over-pressurization', severity: 'High', similarity: 74, date: '2026-07-16' }
      ],
      timeline: [
        { id: `t_${Date.now()}_1`, title: 'Logged', description: 'Incident registered in desk', timestamp: 'Just now', status: 'completed' },
        { id: `t_${Date.now()}_2`, title: 'AI Diagnostics', description: 'Progressive RAG audit performed', timestamp: 'Just now', status: 'completed' }
      ]
    };

    incident.aiAnalysis = mockAnalysis;
    incident.status = 'RCA Complete';
    return mockAnalysis;
  }
};
