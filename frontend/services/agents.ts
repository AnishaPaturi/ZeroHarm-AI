import { AppEvent } from '../lib/eventBus';

export interface AgentResult {
  riskScore: number;
  status: 'Normal' | 'Warning' | 'Critical';
  reason: string;
}

export interface TelemetryAgentState {
  gasLpgLEL: number;
  segmentDPressure: number;
  temperature: number;
}

export interface VisionAgentState {
  totalWorkers: number;
  ppeViolationsCount: number;
  activeViolations: { workerName: string; zone: string; missingPPE: string[] }[];
}

export interface PermitAgentState {
  activePermits: { permitId: string; description: string; zone: string; permitType: string }[];
}

export interface ComplianceAgentState {
  violations: { standardName: string; category: string; description: string }[];
}

// 1. Telemetry Agent
export class TelemetryAgent {
  private state: TelemetryAgentState = { gasLpgLEL: 2.1, segmentDPressure: 9.8, temperature: 38.5 };

  process(event: AppEvent): AgentResult {
    if (event.type === 'GasReadingUpdated') {
      this.state.gasLpgLEL = event.payload.lel;
    } else if (event.type === 'PressureReadingUpdated') {
      this.state.segmentDPressure = event.payload.pressure;
    } else if (event.type === 'TemperatureUpdated') {
      this.state.temperature = event.payload.temp;
    } else if (event.type === 'SimulationReset') {
      this.state = { gasLpgLEL: 2.1, segmentDPressure: 9.8, temperature: 38.5 };
    }

    let riskScore = 10;
    let status: 'Normal' | 'Warning' | 'Critical' = 'Normal';
    const reasons: string[] = [];

    if (this.state.gasLpgLEL > 20) {
      riskScore = 95;
      status = 'Critical';
      reasons.push(`Gas concentration critical at unloading manifolds (${this.state.gasLpgLEL}% LEL)`);
    } else if (this.state.gasLpgLEL > 10) {
      riskScore = 65;
      status = 'Warning';
      reasons.push(`Hydrocarbon gas detection elevated (${this.state.gasLpgLEL}% LEL)`);
    }

    if (this.state.segmentDPressure > 13) {
      riskScore = Math.max(riskScore, 90);
      status = 'Critical';
      reasons.push(`Pipeline pressure exceeds safe rating (${this.state.segmentDPressure} bar)`);
    } else if (this.state.segmentDPressure > 11.5) {
      riskScore = Math.max(riskScore, 60);
      status = 'Warning';
      reasons.push(`Pipeline pressure surge detected (${this.state.segmentDPressure} bar)`);
    }

    return {
      riskScore,
      status,
      reason: reasons.length > 0 ? reasons.join('; ') : 'Telemetry parameters reporting nominal safety levels.'
    };
  }
}

// 2. Vision Agent
export class VisionAgent {
  private state: VisionAgentState = { totalWorkers: 18, ppeViolationsCount: 0, activeViolations: [] };

  process(event: AppEvent): AgentResult {
    if (event.type === 'WorkerEnteredZone') {
      this.state.totalWorkers += 1;
    } else if (event.type === 'WorkerExitedZone') {
      this.state.totalWorkers = Math.max(this.state.totalWorkers - 1, 0);
      this.state.activeViolations = this.state.activeViolations.filter(v => v.workerName !== event.payload.workerId);
    } else if (event.type === 'PPEViolationDetected') {
      const exists = this.state.activeViolations.some(v => v.workerName === event.payload.workerName);
      if (!exists) {
        this.state.activeViolations.push({
          workerName: event.payload.workerName,
          zone: event.payload.zone,
          missingPPE: event.payload.missingPPE
        });
      }
    } else if (event.type === 'SimulationReset') {
      this.state = { totalWorkers: 18, ppeViolationsCount: 0, activeViolations: [] };
    }

    this.state.ppeViolationsCount = this.state.activeViolations.length;

    let riskScore = 15;
    let status: 'Normal' | 'Warning' | 'Critical' = 'Normal';
    const reasons: string[] = [];

    if (this.state.ppeViolationsCount > 0) {
      riskScore = 70;
      status = 'Warning';
      this.state.activeViolations.forEach(v => {
        reasons.push(`Worker ${v.workerName} in ${v.zone} missing PPE: ${v.missingPPE.join(', ')}`);
      });
    }

    return {
      riskScore,
      status,
      reason: reasons.length > 0 ? reasons.join('; ') : 'All workers verified on-camera wearing compliant safety gear.'
    };
  }
}

// 3. Permit Agent
export class PermitAgent {
  private state: PermitAgentState = { activePermits: [] };

  process(event: AppEvent, telemetryState: TelemetryAgentState): AgentResult {
    if (event.type === 'PermitIssued') {
      const exists = this.state.activePermits.some(p => p.permitId === event.payload.permitId);
      if (!exists) {
        this.state.activePermits.push({
          permitId: event.payload.permitId,
          description: event.payload.description,
          zone: event.payload.zone,
          permitType: event.payload.permitType
        });
      }
    } else if (event.type === 'PermitRevoked') {
      this.state.activePermits = this.state.activePermits.filter(p => p.permitId !== event.payload.permitId);
    } else if (event.type === 'SimulationReset') {
      this.state.activePermits = [];
    }

    let riskScore = 0;
    let status: 'Normal' | 'Warning' | 'Critical' = 'Normal';
    const reasons: string[] = [];

    // Audit Conflict Check
    const hasHotWork = this.state.activePermits.some(p => p.permitType === 'Hot Work');
    const lpgLEL = telemetryState.gasLpgLEL;

    if (hasHotWork && lpgLEL > 10) {
      riskScore = 95;
      status = 'Critical';
      reasons.push(`Hot Work Permit active in LPG yard while hydrocarbon LEL is high (${lpgLEL}%) - EXPLOSIVE DISASTER RISK`);
    } else if (hasHotWork && lpgLEL > 2) {
      riskScore = 55;
      status = 'Warning';
      reasons.push(`Hot Work active with fluctuating gas readings (${lpgLEL}% LEL)`);
    }

    return {
      riskScore,
      status,
      reason: reasons.length > 0 ? reasons.join('; ') : 'No active permit scheduling conflicts detected.'
    };
  }
}

// 4. Compliance Agent
export class ComplianceAgent {
  private state: ComplianceAgentState = { violations: [] };

  process(event: AppEvent): AgentResult {
    if (event.type === 'ComplianceViolationDetected') {
      const exists = this.state.violations.some(v => v.standardName === event.payload.standardName);
      if (!exists) {
        this.state.violations.push({
          standardName: event.payload.standardName,
          category: event.payload.category,
          description: event.payload.description
        });
      }
    } else if (event.type === 'SimulationReset') {
      this.state.violations = [];
    }

    let riskScore = 5;
    let status: 'Normal' | 'Warning' | 'Critical' = 'Normal';
    const reasons: string[] = [];

    if (this.state.violations.length > 0) {
      riskScore = Math.min(this.state.violations.length * 25, 90);
      status = riskScore >= 75 ? 'Critical' : 'Warning';
      this.state.violations.forEach(v => {
        reasons.push(`${v.category} Breach: ${v.standardName} - ${v.description}`);
      });
    }

    return {
      riskScore,
      status,
      reason: reasons.length > 0 ? reasons.join('; ') : 'Plant operations align with OISD, DGMS, and Factory Act directives.'
    };
  }
}

// 5. Incident Intelligence Agent
export class IncidentIntelligenceAgent {
  process(event: AppEvent) {
    if (event.type === 'IncidentCreated') {
      // Simulate historical precedent search (RAG)
      return {
        matchedPrecedents: [
          { id: 'inc_old_1', title: 'Pressure relief valve spring seizure A-4', similarity: 82 },
          { id: 'inc_old_2', title: 'Propane manifold leak at unloading joint', similarity: 91 }
        ]
      };
    }
    return { matchedPrecedents: [] };
  }
}

// 6. Emergency Agent
export class EmergencyAgent {
  process(event: AppEvent, telemetryState: TelemetryAgentState): { evacuationNeeded: boolean; isolationRequired: boolean; shutdownWarnings: string[] } {
    let evacuationNeeded = false;
    let isolationRequired = false;
    const shutdownWarnings: string[] = [];

    if (telemetryState.gasLpgLEL > 25) {
      evacuationNeeded = true;
      isolationRequired = true;
      shutdownWarnings.push('Automatic Emergency Evacuation Siren Active. Isolate zone.');
    }
    if (telemetryState.segmentDPressure > 13.5) {
      evacuationNeeded = true;
      isolationRequired = true;
      shutdownWarnings.push('Emergency Pipeline Evacuation sirens active. Vent Flare Segment D.');
    }

    if (event.type === 'EmergencyDeclared') {
      evacuationNeeded = true;
      shutdownWarnings.push(`Operator Override: ${event.payload.message}`);
    }

    return {
      evacuationNeeded,
      isolationRequired,
      shutdownWarnings
    };
  }
}

// 7. Risk Fusion Agent (The orchestrator)
export class RiskFusionAgent {
  fuse(
    telemetry: AgentResult,
    vision: AgentResult,
    permit: AgentResult,
    compliance: AgentResult,
    emergency: { evacuationNeeded: boolean; isolationRequired: boolean; shutdownWarnings: string[] }
  ): { compoundRiskScore: number; recommendations: string[]; reasoning: string; detectedHazards: string[] } {
    
    // Weighted Compound Risk Calculation
    let compoundRiskScore = Math.round(
      (telemetry.riskScore * 0.35) + 
      (vision.riskScore * 0.20) + 
      (permit.riskScore * 0.25) + 
      (compliance.riskScore * 0.20)
    );

    if (emergency.evacuationNeeded) {
      compoundRiskScore = Math.max(compoundRiskScore, 98);
    }

    const recommendations: string[] = [];
    const detectedHazards: string[] = [];
    const reasonParts: string[] = [];

    // Formulate explainable reasoning and actionable recommendations
    if (telemetry.status !== 'Normal') {
      detectedHazards.push('Sensor Telemetry Alert');
      reasonParts.push(`Sensors detect abnormal values (${telemetry.reason})`);
      recommendations.push('Deploy mobile gas sniffer patrol to check flange joints');
      recommendations.push('Calibrate segment transducer transmitters');
    }

    if (vision.status !== 'Normal') {
      detectedHazards.push('PPE Compliance Breach');
      reasonParts.push(`PPE checks detect missing gear (${vision.reason})`);
      recommendations.push('Broadcast warning signal to workers in breach segments');
      recommendations.push('Ensure crew safety harness line hooks are verified');
    }

    if (permit.status !== 'Normal') {
      detectedHazards.push('Permit Scheduling Conflict');
      reasonParts.push(`Permit audits show conflicting activity (${permit.reason})`);
      recommendations.push('Immediately suspend Hot Work permits in Zone 1/2 boundaries');
      recommendations.push('Evacuate welding personnel from manifold yards');
    }

    if (compliance.status !== 'Normal') {
      detectedHazards.push('Regulatory Code Failure');
      reasonParts.push(`Compliance scans report standards variance (${compliance.reason})`);
      recommendations.push('File Form I-A regulatory audit check failure logs with DGMS');
    }

    if (emergency.evacuationNeeded) {
      detectedHazards.push('Plant Evacuation Alarm');
      reasonParts.push('Emergency evacuation trigger reached');
      recommendations.push('ENGAGE SIRENS: Evacuate all personnel to Refinery Assembly Point Alpha');
      recommendations.push('CLOSE ESD ISOLATION VALVES: Vent manifolds directly into flare loop');
    }

    const reasoning = reasonParts.length > 0 
      ? `AI Risk Fusion detects a compound risk level of ${compoundRiskScore}% because: ${reasonParts.join('; and ')}.`
      : 'All operational parameters (sensors, workers, permits) align with safe, normal guidelines. Compound risk: 10%.';

    return {
      compoundRiskScore,
      recommendations: recommendations.length > 0 ? recommendations : ['Maintain normal plant safety surveillance rounds.'],
      reasoning,
      detectedHazards: detectedHazards.length > 0 ? detectedHazards : ['None']
    };
  }
}
