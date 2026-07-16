export type AppEvent = 
  | { type: 'GasReadingUpdated'; payload: { zone: string; lel: number } }
  | { type: 'PressureReadingUpdated'; payload: { line: string; pressure: number } }
  | { type: 'TemperatureUpdated'; payload: { area: string; temp: number } }
  | { type: 'WorkerEnteredZone'; payload: { workerId: string; workerName: string; zone: string; ppeOk: boolean } }
  | { type: 'WorkerExitedZone'; payload: { workerId: string; zone: string } }
  | { type: 'PPEViolationDetected'; payload: { workerId: string; workerName: string; zone: string; missingPPE: string[] } }
  | { type: 'PermitIssued'; payload: { permitId: string; description: string; zone: string; permitType: string } }
  | { type: 'PermitRevoked'; payload: { permitId: string } }
  | { type: 'EquipmentFaultDetected'; payload: { equipId: string; line: string; fault: string } }
  | { type: 'MaintenanceStarted'; payload: { equipId: string; task: string } }
  | { type: 'MaintenanceCompleted'; payload: { equipId: string } }
  | { type: 'IncidentCreated'; payload: { id: string; title: string; description: string; location: string; department: string; severity: 'Low' | 'Medium' | 'High' | 'Critical'; reporterName?: string; reporterRole?: string } }
  | { type: 'IncidentResolved'; payload: { id: string } }
  | { type: 'ComplianceViolationDetected'; payload: { id: string; standardName: string; category: 'OISD' | 'DGMS' | 'Factory Act'; description: string } }
  | { type: 'EmergencyDeclared'; payload: { message: string } }
  | { type: 'EmergencyCleared'; payload: {} }
  | { type: 'AlertAcknowledged'; payload: { alertId: string } }
  | { type: 'ComplianceChecklistToggled'; payload: { recordId: string; itemId: string; checked: boolean } }
  | { type: 'SimulationReset'; payload: {} };

type Subscriber = (event: AppEvent) => void;

class EventBus {
  private subscribers: Subscriber[] = [];

  subscribe(callback: Subscriber): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  publish(event: AppEvent): void {
    this.subscribers.forEach(sub => sub(event));
  }
}

export const eventBus = new EventBus();
