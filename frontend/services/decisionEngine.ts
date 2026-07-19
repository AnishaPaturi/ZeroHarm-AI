import { useIncident } from '../hooks/useIncident';
import { WS_BASE_URL, fetchBackend } from './api';
import { mapBackendReport } from './incident';

let ws: WebSocket | null = null;

// Helper to map backend RAG documents to frontend ComplianceRecords
function mapRAGToCompliance(docs: any[]): any[] {
  return docs.map(doc => {
    let category = 'OISD';
    const titleLower = doc.title.toLowerCase();
    if (titleLower.includes('factories act') || titleLower.includes('factory act')) {
      category = 'Factory Act';
    } else if (titleLower.includes('dgms')) {
      category = 'DGMS';
    }

    const checklist: any[] = [];
    const lines = doc.content.split('\n');
    let itemId = 1;
    
    lines.forEach((line: string) => {
      const trimmed = line.trim();
      const match = trimmed.match(/^(\d+)[\.\)]\s*(.+)$/);
      if (match) {
        checklist.push({
          id: `${doc.id}_item_${itemId++}`,
          text: match[2],
          checked: Math.random() > 0.4
        });
      }
    });

    if (checklist.length === 0) {
      const sentences = doc.content.match(/[^.!?]+[.!?]+/g) || [doc.content];
      sentences.slice(0, 4).forEach((sentence: string) => {
        const text = sentence.trim();
        if (text.length > 10) {
          checklist.push({
            id: `${doc.id}_item_${itemId++}`,
            text: text,
            checked: Math.random() > 0.4
          });
        }
      });
    }

    const checkedCount = checklist.filter(c => c.checked).length;
    const score = checklist.length > 0 ? Math.round((checkedCount / checklist.length) * 100) : 100;
    const status = score === 100 ? 'Compliant' : score > 50 ? 'Pending Audit' : 'Non-Compliant';

    const inspectors = ['Sarah Jenkins', 'David Vance', 'Marcus Brody'];
    const inspector = inspectors[Math.floor(Math.random() * inspectors.length)];

    return {
      id: doc.id,
      standardName: doc.title,
      category: category,
      status: status,
      lastAudited: new Date().toISOString().split('T')[0],
      score: score,
      inspector: inspector,
      criticalFindingsCount: score < 50 ? 1 : 0,
      checklist: checklist
    };
  });
}

// Function to fetch compliance documents from the backend RAG store and map to checklists
async function syncCompliance() {
  try {
    const ragDocs = await fetchBackend<any[]>('/api/rag/documents');
    const mappedCompliance = mapRAGToCompliance(ragDocs);
    useIncident.setState({ complianceRecords: mappedCompliance });
  } catch (err) {
    console.warn('Failed to sync compliance records from backend:', err);
  }
}

// Function to fetch near miss predictions from the backend and update store
async function syncNearMisses() {
  try {
    const nearMisses = await fetchBackend<any[]>('/api/near-misses');
    useIncident.setState({ nearMisses });
  } catch (err) {
    console.warn('Failed to sync near-miss predictions from backend:', err);
  }
}
let reconnectTimeout: NodeJS.Timeout | null = null;
let workersInterval: NodeJS.Timeout | null = null;
let listRefreshInterval: NodeJS.Timeout | null = null;

// Helper to check if any zone has Critical risk in the backend state
function checkEmergencyStatus(state: any): { active: boolean; message: string } {
  let hasEmergency = false;
  let message = '';
  
  for (const zoneState of Object.values(state) as any[]) {
    // If the zone has critical risk or has active evacuation
    if (zoneState.risk_assessment?.risk_level === 'Critical' || zoneState.risk_assessment?.composite_risk_score >= 75) {
      hasEmergency = true;
      message = zoneState.risk_assessment.action_required || 'Critical hazard alert in ' + zoneState.zone;
      break;
    }
  }
  
  return { active: hasEmergency, message };
}

// Function to fetch worker locations from the backend and update store
async function syncWorkers() {
  try {
    const backendWorkers = await fetchBackend<any[]>('/api/workers');
    const mappedWorkers = backendWorkers.map(w => ({
      id: w.worker_id,
      name: w.name,
      zone: w.zone,
      ppeOk: w.status !== 'evacuating' // Mark as not PPE OK if they are evacuating to flag highlight
    }));
    useIncident.setState({ workers: mappedWorkers });
  } catch (err) {
    console.warn('Failed to sync workers from backend:', err);
  }
}

// Function to fetch active alerts from the backend and update store
async function syncAlerts() {
  try {
    const backendAlerts = await fetchBackend<any[]>('/api/alerts');
    const mappedAlerts = backendAlerts.map((a, idx) => ({
      id: a.alert_id || `a_${idx}`,
      message: a.message,
      severity: a.status === 'critical' ? 'Critical' : 'Warning' as any,
      timestamp: a.sent_at || new Date().toISOString(),
      department: a.zone || 'Safety Orchestrator'
    }));
    useIncident.setState({ alerts: mappedAlerts });
  } catch (err) {
    console.warn('Failed to sync alerts from backend:', err);
  }
}

// Function to fetch incidents from the backend and update store
async function syncIncidents() {
  try {
    const backendReports = await fetchBackend<any[]>('/api/incidents');
    const mappedIncidents = backendReports.map(mapBackendReport);
    
    // Fetch local ones
    const localStr = typeof window !== 'undefined' ? localStorage.getItem('local_incidents') : null;
    const localIncidents = localStr ? JSON.parse(localStr) : [];
    const ids = new Set(mappedIncidents.map(i => i.id));
    const filteredLocal = localIncidents.filter((i: any) => !ids.has(i.id));

    useIncident.setState({ incidents: [...filteredLocal, ...mappedIncidents] });
  } catch (err) {
    console.warn('Failed to sync incidents from backend:', err);
  }
}

// Main function to establish WebSocket connection with the backend
function connectWebSocket() {
  if (ws) {
    try {
      ws.close();
    } catch (e) {}
  }

  const wsUrl = `${WS_BASE_URL}/ws/risk-feed`;
  console.log(`Connecting to ZeroHarm WebSocket: ${wsUrl}`);
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('ZeroHarm WebSocket connection established successfully.');
    // Trigger initial REST sync
    syncWorkers();
    syncAlerts();
    syncIncidents();
    syncCompliance();
    syncNearMisses();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const store = useIncident.getState();

      if (data.event === 'initial_state') {
        console.log('Received initial state snapshot from backend.', data);
        
        // Sync telemetry values based on active zones
        const coBatteryState = data.state['Coke Oven Battery 1'];
        const blastFurnaceState = data.state['Blast Furnace A'];
        
        const newTelemetry = {
          gasLpgLEL: coBatteryState?.gas_readings?.ch4_lfl || 2.1,
          segmentDPressure: blastFurnaceState?.gas_readings?.pressure || 9.8,
          temperature: blastFurnaceState?.gas_readings?.temperature || 38.5
        };

        // Gather all active permits from backend zones
        const allPermits: any[] = [];
        Object.values(data.state).forEach((zoneState: any) => {
          if (zoneState.permits) {
            zoneState.permits.forEach((p: any) => {
              allPermits.push({
                permitId: p.permit_id,
                description: `${p.permit_type.toUpperCase()} permit active in ${zoneState.zone}`,
                zone: zoneState.zone,
                permitType: p.permit_type
              });
            });
          }
        });

        // Determine emergency state
        const emergency = checkEmergencyStatus(data.state);

        useIncident.setState({
          telemetry: newTelemetry,
          activePermits: allPermits,
          emergencyMode: emergency.active,
          evacuationMessage: emergency.message
        });

        store.logEvent({
          type: 'SimulationReset',
          payload: { message: '[BACKEND] Connected to safety server. Initial snapshot loaded.' }
        });

      } else if (data.event === 'risk_update') {
        const { zone, state, risk_assessment } = data;
        
        // Dynamic telemetry mapping based on updated zone
        useIncident.setState((s) => {
          const telemetry = { ...s.telemetry };
          if (zone === 'Coke Oven Battery 1') {
            telemetry.gasLpgLEL = state.gas_readings.ch4_lfl;
          } else if (zone === 'Blast Furnace A') {
            telemetry.segmentDPressure = state.gas_readings.pressure;
            telemetry.temperature = state.gas_readings.temperature;
          }
          
          return { telemetry };
        });

        // Log reasoning metrics
        useIncident.setState({
          aiReasoning: {
            reasoning: risk_assessment.action_required || 'Nominal operating conditions.',
            recommendations: risk_assessment.factors ? risk_assessment.factors.map((f: any) => f.details) : [],
            detectedHazards: risk_assessment.factors ? risk_assessment.factors.map((f: any) => f.name) : []
          }
        });

        // Check if emergency triggered
        if (risk_assessment.risk_level === 'Critical') {
          useIncident.setState({
            emergencyMode: true,
            evacuationMessage: risk_assessment.action_required
          });
        } else {
          // Verify if other zones are in emergency
          fetchBackend<any>('/api/state')
            .then(allState => {
              const emergency = checkEmergencyStatus(allState);
              useIncident.setState({
                emergencyMode: emergency.active,
                evacuationMessage: emergency.message
              });
            })
            .catch(() => {});
        }

        // Log event in simulation console
        store.logEvent({
          type: 'EmergencyDeclared',
          payload: { 
            message: `[BACKEND] ${zone}: Risk evaluates ${risk_assessment.composite_risk_score} (${risk_assessment.risk_level})` 
          }
        });

        // Refresh alerts and incidents lists
        syncAlerts();
        syncIncidents();
        syncNearMisses();
        
      } else if (data.event === 'collaborative_debate') {
        const { zone, debate } = data;
        useIncident.setState({ activeDebate: debate });
        store.logEvent({
          type: 'ComplianceViolationDetected',
          payload: {
            id: `debate_audit_${Date.now()}`,
            standardName: 'Collaborative Agentic Debate',
            category: 'OISD',
            description: `[DEBATE] Zone ${zone}: safety agents completed reasoning. Prediction: ${debate.prediction}`
          }
        });
      } else if (data.event === 'permit_alert') {
        const { zone, permit_audit } = data;
        store.logEvent({
          type: 'ComplianceViolationDetected',
          payload: {
            id: `ptw_audit_${Date.now()}`,
            standardName: 'Permit Safety Audit',
            category: 'OISD',
            description: `Zone ${zone}: Permit conflict detected! ${permit_audit.conflicts?.map((c: any) => c.details).join('; ') || ''}`
          }
        });
        syncAlerts();
      }
    } catch (e) {
      console.warn('Error parsing WebSocket message:', e);
    }
  };

  ws.onerror = () => {
    // Silent error logging to avoid browser console spam when backend is down
    console.warn('ZeroHarm WebSocket connection offline (backend server not running on port 8000).');
  };

  ws.onclose = () => {
    reconnectTimeout = setTimeout(connectWebSocket, 5000);
  };
}

export const initDecisionEngine = () => {
  // Start WebSocket client connection
  if (typeof window !== 'undefined') {
    connectWebSocket();
    
    // Initial sync immediately via REST
    syncWorkers();
    syncAlerts();
    syncIncidents();
    syncCompliance();
    syncNearMisses();
    
    // Set up continuous synchronization loops
    workersInterval = setInterval(syncWorkers, 2500);
    listRefreshInterval = setInterval(() => {
      syncAlerts();
      syncIncidents();
      syncCompliance();
      syncNearMisses();
    }, 5000);
  }

  // Return unsubscribe cleanup handler
  return () => {
    if (ws) {
      try {
        ws.close();
      } catch (e) {}
      ws = null;
    }
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (workersInterval) clearInterval(workersInterval);
    if (listRefreshInterval) clearInterval(listRefreshInterval);
    console.log('Cleaned up ZeroHarm backend synchronization sync engine loops.');
  };
};
