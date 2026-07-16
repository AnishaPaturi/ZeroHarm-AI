import { eventBus, AppEvent } from '../lib/eventBus';
import { 
  TelemetryAgent, 
  VisionAgent, 
  PermitAgent, 
  ComplianceAgent, 
  IncidentIntelligenceAgent, 
  EmergencyAgent, 
  RiskFusionAgent 
} from './agents';
import { useIncident } from '../hooks/useIncident';
import { IncidentSeverity, IncidentStatus } from '../types/incident';

const telemetryAgent = new TelemetryAgent();
const visionAgent = new VisionAgent();
const permitAgent = new PermitAgent();
const complianceAgent = new ComplianceAgent();
const incidentIntelAgent = new IncidentIntelligenceAgent();
const emergencyAgent = new EmergencyAgent();
const riskFusionAgent = new RiskFusionAgent();

export const initDecisionEngine = () => {
  return eventBus.subscribe((event: AppEvent) => {
    // Get latest state
    const store = useIncident.getState();

    // 1. Log event in the audit trail
    store.logEvent(event);

    // 2. Decision Engine updates raw states
    switch (event.type) {
      case 'GasReadingUpdated':
        store.updateTelemetry({ gasLpgLEL: event.payload.lel });
        break;
      case 'PressureReadingUpdated':
        store.updateTelemetry({ segmentDPressure: event.payload.pressure });
        break;
      case 'TemperatureUpdated':
        store.updateTelemetry({ temperature: event.payload.temp });
        break;
      case 'WorkerEnteredZone': {
        const wExists = store.workers.some(w => w.id === event.payload.workerId);
        if (!wExists) {
          store.setWorkers([
            ...store.workers, 
            { id: event.payload.workerId, name: event.payload.workerName, zone: event.payload.zone, ppeOk: event.payload.ppeOk }
          ]);
        }
        break;
      }
      case 'WorkerExitedZone':
        store.setWorkers(store.workers.filter(w => w.id !== event.payload.workerId));
        break;
      case 'PPEViolationDetected':
        store.setWorkers(store.workers.map(w => {
          if (w.name === event.payload.workerName) {
            return { ...w, ppeOk: false };
          }
          return w;
        }));
        break;
      case 'PermitIssued': {
        const pExists = store.activePermits.some(p => p.permitId === event.payload.permitId);
        if (!pExists) {
          store.setPermits([
            ...store.activePermits,
            { permitId: event.payload.permitId, description: event.payload.description, zone: event.payload.zone, permitType: event.payload.permitType }
          ]);
        }
        break;
      }
      case 'PermitRevoked':
        store.setPermits(store.activePermits.filter(p => p.permitId !== event.payload.permitId));
        break;
      case 'IncidentCreated': {
        const incExists = store.incidents.some(i => i.id === event.payload.id);
        if (!incExists) {
          store.addIncident({
            id: event.payload.id,
            title: event.payload.title,
            description: event.payload.description,
            location: event.payload.location,
            department: event.payload.department,
            severity: event.payload.severity as IncidentSeverity,
            status: 'Reported' as IncidentStatus,
            reportedAt: new Date().toISOString(),
            reporterName: event.payload.reporterName || 'AI Agent Core',
            reporterRole: (event.payload.reporterRole as any) || 'Safety Officer',
            comments: []
          });
        }
        break;
      }
      case 'IncidentResolved':
        store.updateIncident(event.payload.id, { status: 'Resolved' as IncidentStatus });
        break;
      case 'ComplianceViolationDetected':
        store.setComplianceRecords(store.complianceRecords.map(c => {
          if (c.standardName.includes(event.payload.standardName) || c.category === event.payload.category) {
            return { ...c, status: 'Non-Compliant' as any, score: 72, criticalFindingsCount: 1 };
          }
          return c;
        }));
        break;
      case 'EmergencyDeclared':
        store.setEmergency(true, event.payload.message);
        break;
      case 'EmergencyCleared':
        store.setEmergency(false, '');
        break;
      case 'AlertAcknowledged':
        store.removeAlert(event.payload.alertId);
        break;
      case 'ComplianceChecklistToggled': {
        const updatedRecords = store.complianceRecords.map(rec => {
          if (rec.id === event.payload.recordId) {
            const list = rec.checklist || [];
            const updatedChecklist = list.map(item =>
              item.id === event.payload.itemId ? { ...item, checked: event.payload.checked } : item
            );
            const checkedCount = updatedChecklist.filter(c => c.checked).length;
            const computedScore = updatedChecklist.length > 0 ? Math.round((checkedCount / updatedChecklist.length) * 100) : 0;
            const nextStatus = computedScore === 100 ? 'Compliant' : computedScore > 50 ? 'Pending Audit' : 'Non-Compliant';

            return {
              ...rec,
              score: computedScore,
              status: nextStatus as any,
              criticalFindingsCount: computedScore < 50 ? 1 : 0,
              checklist: updatedChecklist
            };
          }
          return rec;
        });
        store.setComplianceRecords(updatedRecords);
        break;
      }
      case 'SimulationReset':
        store.resetStore();
        break;
    }

    // 3. Gather updated parameters
    const currentTelemetry = {
      gasLpgLEL: store.telemetry.gasLpgLEL,
      segmentDPressure: store.telemetry.segmentDPressure,
      temperature: store.telemetry.temperature
    };

    // 4. Process events through reasoning agents
    const telemetryResult = telemetryAgent.process(event);
    const visionResult = visionAgent.process(event);
    const permitResult = permitAgent.process(event, currentTelemetry);
    const complianceResult = complianceAgent.process(event);
    const emergencyResult = emergencyAgent.process(event, currentTelemetry);
    const incidentIntelResult = incidentIntelAgent.process(event);

    // 5. Execute Risk Fusion coordination
    const fusion = riskFusionAgent.fuse(
      telemetryResult,
      visionResult,
      permitResult,
      complianceResult,
      emergencyResult
    );

    // 6. Dispatch reasoning text and recommendations to store
    store.setAIReasoning(fusion.reasoning, fusion.recommendations, fusion.detectedHazards);

    // 7. Auto-escalate status (add alerts/incidents if agent thresholds are breached)
    if (fusion.compoundRiskScore > 70) {
      const alertMsg = `Risk Fusion Alert: ${fusion.reasoning.substring(0, 60)}...`;
      const alertExists = store.alerts.some(a => a.message.substring(0, 30) === alertMsg.substring(0, 30));
      
      if (!alertExists) {
        store.addAlert({
          id: `a_auto_${Date.now()}`,
          message: alertMsg,
          severity: fusion.compoundRiskScore > 90 ? 'Critical' : 'Warning',
          timestamp: new Date().toISOString(),
          department: 'Risk Fusion'
        });
      }
    }

    // Handle evacuation alerts
    if (emergencyResult.evacuationNeeded && !store.emergencyMode) {
      store.setEmergency(true, emergencyResult.shutdownWarnings.join('; '));
    }
  });
};
