import { eventBus } from '../lib/eventBus';
import { useIncident } from '../hooks/useIncident';

export type ScenarioType = 
  | 'Normal' 
  | 'Gas Leak' 
  | 'PPE Breach' 
  | 'Machine Overheating' 
  | 'Confined Space' 
  | 'Compound Risk' 
  | 'Emergency Evacuation';

class ScenarioEngine {
  private activeInterval: NodeJS.Timeout | null = null;
  private timelineIndex = 0;
  private activeScenario: ScenarioType = 'Normal';
  private isPaused = false;

  startScenario(type: ScenarioType) {
    this.stop();
    this.activeScenario = type;
    this.timelineIndex = 0;
    this.isPaused = false;

    addLogToConsole(`Loading Scenario: ${type}...`);
    
    if (type === 'Normal') {
      this.runNormalOperations();
    } else {
      this.runTimelineScenario(type);
    }
  }

  pause() {
    this.isPaused = true;
    addLogToConsole('Scenario execution paused.');
  }

  resume() {
    this.isPaused = false;
    addLogToConsole('Scenario execution resumed.');
  }

  stop() {
    if (this.activeInterval) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }
  }

  reset() {
    this.stop();
    eventBus.publish({ type: 'SimulationReset', payload: {} });
    addLogToConsole('Plant telemetry reset to nominal default parameters.');
  }

  private runNormalOperations() {
    // Fluctuates parameters slowly indefinitely
    this.activeInterval = setInterval(() => {
      if (this.isPaused) return;

      const randomGas = parseFloat((Math.random() * 0.8 + 1.8).toFixed(2));
      const randomPressure = parseFloat((Math.random() * 0.6 + 9.5).toFixed(2));
      const randomTemp = parseFloat((Math.random() * 2 + 37).toFixed(2));

      eventBus.publish({ type: 'GasReadingUpdated', payload: { zone: 'LPG Yard', lel: randomGas } });
      eventBus.publish({ type: 'PressureReadingUpdated', payload: { line: 'Distillation Unit A', pressure: randomPressure } });
      eventBus.publish({ type: 'TemperatureUpdated', payload: { area: 'Plant A', temp: randomTemp } });

      // Occasionally cycle a worker
      if (Math.random() > 0.8) {
        const id = `w_${Math.floor(Math.random() * 5) + 1}`;
        const entered = Math.random() > 0.5;
        if (entered) {
          eventBus.publish({ 
            type: 'WorkerEnteredZone', 
            payload: { workerId: id, workerName: getWorkerName(id), zone: 'LPG Yard', ppeOk: true } 
          });
        } else {
          eventBus.publish({ type: 'WorkerExitedZone', payload: { workerId: id, zone: 'LPG Yard' } });
        }
      }
    }, 3000);
  }

  private runTimelineScenario(type: ScenarioType) {
    const timelines: Record<Exclude<ScenarioType, 'Normal'>, { time: number; action: () => void }[]> = {
      'Gas Leak': [
        { time: 0, action: () => eventBus.publish({ type: 'GasReadingUpdated', payload: { zone: 'LPG Yard', lel: 5.2 } }) },
        { time: 3, action: () => eventBus.publish({ type: 'GasReadingUpdated', payload: { zone: 'LPG Yard', lel: 12.8 } }) },
        { time: 6, action: () => eventBus.publish({ type: 'GasReadingUpdated', payload: { zone: 'LPG Yard', lel: 22.4 } }) },
        { time: 9, action: () => eventBus.publish({ 
            type: 'IncidentCreated', 
            payload: { id: 'inc_auto_leak', title: 'LPG Yard Hydrocarbon Vapor Leak', description: 'Sensor HC-104 reports LPG gas levels exceeding 20% LEL. High explosion hazard.', location: 'Unloading Bay 3, LPG Yard', department: 'Plant Operations', severity: 'Critical' } 
          }) 
        },
        { time: 12, action: () => eventBus.publish({ type: 'ComplianceViolationDetected', payload: { id: 'c_viol_leak', standardName: 'DGMS Circular 14 (Gas Telemetry Links)', category: 'DGMS', description: 'Gas leak alarms failed to auto-trip the manifold ESD shutdown loops.' } }) },
        { time: 15, action: () => eventBus.publish({ type: 'EmergencyDeclared', payload: { message: 'Gas leak breach in LPG enclosure. Evacuate LPG Yard.' } }) }
      ],
      'PPE Breach': [
        { time: 0, action: () => eventBus.publish({ type: 'WorkerEnteredZone', payload: { workerId: 'w_5', workerName: 'Alex Rivera', zone: 'Distillation Unit A', ppeOk: true } }) },
        { time: 3, action: () => eventBus.publish({ type: 'PPEViolationDetected', payload: { workerId: 'w_5', workerName: 'Alex Rivera', zone: 'Distillation Unit A', missingPPE: ['Hard Hat', 'Safety Goggles'] } }) },
        { time: 6, action: () => eventBus.publish({
            type: 'IncidentCreated',
            payload: { id: 'inc_auto_ppe', title: 'Unsecured Worker Operating in Zone 1 Area', description: 'Visual neural scan detects contractor operating active valves without compliant PPE headwear.', location: 'Distillation Unit A', department: 'Maintenance', severity: 'Medium' }
          })
        }
      ],
      'Machine Overheating': [
        { time: 0, action: () => eventBus.publish({ type: 'PressureReadingUpdated', payload: { line: 'Distillation Unit A', pressure: 10.5 } }) },
        { time: 3, action: () => eventBus.publish({ type: 'PressureReadingUpdated', payload: { line: 'Distillation Unit A', pressure: 12.2 } }) },
        { time: 6, action: () => eventBus.publish({ type: 'EquipmentFaultDetected', payload: { equipId: 'valve_d4', line: 'Distillation Unit A', fault: 'Pressure relief valve spring seizure' } }) },
        { time: 9, action: () => eventBus.publish({ type: 'PressureReadingUpdated', payload: { line: 'Distillation Unit A', pressure: 13.8 } }) },
        { time: 12, action: () => eventBus.publish({
            type: 'IncidentCreated',
            payload: { id: 'inc_auto_heat', title: 'Pressure Release Valve overpressure surge', description: 'Distillation pipeline reached 13.8 bar. Safety valve relief spring failed to actuate.', location: 'Segment D-4, Distillation Unit A', department: 'Plant Operations', severity: 'High' }
          })
        }
      ],
      'Confined Space': [
        { time: 0, action: () => eventBus.publish({ type: 'WorkerEnteredZone', payload: { workerId: 'w_3', workerName: 'Marcus Brody', zone: 'Confined Vessel Tank 12', ppeOk: true } }) },
        { time: 3, action: () => eventBus.publish({ type: 'ComplianceViolationDetected', payload: { id: 'c_viol_conf', standardName: 'OISD-STD-105 (Emergency Drill Register)', category: 'OISD', description: 'Confined space entry logged without matching safety standby watcher details.' } }) }
      ],
      'Compound Risk': [
        { time: 0, action: () => eventBus.publish({ type: 'GasReadingUpdated', payload: { zone: 'LPG Yard', lel: 4.8 } }) },
        { time: 3, action: () => eventBus.publish({ type: 'MaintenanceStarted', payload: { equipId: 'manifold_joint', task: 'Welding and pipe gasket replacement' } }) },
        { time: 6, action: () => eventBus.publish({ type: 'PermitIssued', payload: { permitId: 'p_hot_90', description: 'Hot Work Welding and joint grinding', zone: 'LPG Yard', permitType: 'Hot Work' } }) },
        { time: 9, action: () => eventBus.publish({ type: 'GasReadingUpdated', payload: { zone: 'LPG Yard', lel: 12.5 } }) },
        { time: 12, action: () => eventBus.publish({
            type: 'IncidentCreated',
            payload: { id: 'inc_auto_comp', title: 'Critical Hot Work Scheduling Conflict', description: 'Hot Work permit active in LPG transfer bay during hydrocarbon gas elevation (12.5% LEL). High explosive hazard.', location: 'LPG Yard', department: 'Plant Operations', severity: 'Critical' }
          })
        }
      ],
      'Emergency Evacuation': [
        { time: 0, action: () => eventBus.publish({ type: 'GasReadingUpdated', payload: { zone: 'LPG Yard', lel: 35.0 } }) },
        { time: 3, action: () => eventBus.publish({ type: 'PressureReadingUpdated', payload: { line: 'Distillation Unit A', pressure: 14.2 } }) },
        { time: 6, action: () => eventBus.publish({ type: 'EmergencyDeclared', payload: { message: 'Critical plant-wide pressure and gas containment failure. Evacuate sectors.' } }) }
      ]
    };

    const timeline = timelines[type as Exclude<ScenarioType, 'Normal'>];

    this.activeInterval = setInterval(() => {
      if (this.isPaused) return;

      const currentEvent = timeline.find((t: any) => t.time === this.timelineIndex);
      if (currentEvent) {
        currentEvent.action();
      }

      this.timelineIndex++;
      
      // Stop when timeline completes
      if (this.timelineIndex > timeline[timeline.length - 1].time + 2) {
        this.stop();
        addLogToConsole(`Scenario ${type} completed execution.`);
      }
    }, 1000);
  }
}

const getWorkerName = (id: string) => {
  const names: Record<string, string> = {
    w_1: 'Sarah Jenkins',
    w_2: 'David Vance',
    w_3: 'Marcus Brody',
    w_4: 'John Doe',
    w_5: 'Alex Rivera'
  };
  return names[id] || 'Contractor Crew';
};

const addLogToConsole = (text: string) => {
  const store = useIncident.getState();
  store.logEvent({
    type: 'EmergencyDeclared',
    payload: { message: `[SYSTEM LOG] ${text}` }
  });
};

export const scenarioEngine = new ScenarioEngine();
