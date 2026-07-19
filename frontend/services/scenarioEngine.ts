import { fetchBackend } from './api';

export type ScenarioType = 
  | 'Normal' 
  | 'Gas Leak' 
  | 'PPE Breach' 
  | 'Machine Overheating' 
  | 'Confined Space' 
  | 'Compound Risk' 
  | 'Emergency Evacuation'
  | 'Near Miss';

class ScenarioEngine {
  private activeInterval: NodeJS.Timeout | null = null;
  private activeScenario: ScenarioType = 'Normal';
  private isPaused = false;

  async startScenario(type: ScenarioType) {
    this.stop();
    this.activeScenario = type;
    this.isPaused = false;

    this.addLogToConsole(`Requesting Backend Scenario: ${type}...`);

    try {
      if (type === 'Normal') {
        // Reset and clear any active alerts
        await this.clearAllBackendAlerts();
        await this.setNominalState();
      } else if (type === 'Gas Leak') {
        // High CH4 gas leak on Coke Oven Battery 1
        await fetchBackend('/api/state/update?zone_name=Coke Oven Battery 1', {
          method: 'POST',
          body: JSON.stringify({
            gas_readings: { o2: 20.8, co: 5.0, ch4_lfl: 22.4, h2s: 0.1, temperature: 32.5, pressure: 1.02 }
          })
        });
      } else if (type === 'PPE Breach') {
        // CCTV PPE violation in Coke Oven Battery 1
        await fetchBackend('/api/cctv/event', {
          method: 'POST',
          body: JSON.stringify({
            zone: 'Coke Oven Battery 1',
            event_type: 'no_ppe',
            confidence: 0.94
          })
        });
      } else if (type === 'Machine Overheating') {
        // Pressure and temp spike in Blast Furnace A
        await fetchBackend('/api/state/update?zone_name=Blast Furnace A', {
          method: 'POST',
          body: JSON.stringify({
            gas_readings: { o2: 20.9, co: 12.0, ch4_lfl: 0.2, h2s: 0.1, temperature: 88.5, pressure: 1.45 }
          })
        });
      } else if (type === 'Confined Space') {
        // Oxygen depletion in Sinter Plant (with active confined space permit)
        await fetchBackend('/api/state/update?zone_name=Sinter Plant', {
          method: 'POST',
          body: JSON.stringify({
            gas_readings: { o2: 15.8, co: 28.0, ch4_lfl: 0.0, h2s: 0.2, temperature: 29.0, pressure: 0.98 }
          })
        });
      } else if (type === 'Compound Risk') {
        // Flammable gas overlap during active Hot Work permit in Coke Oven Battery 1
        await fetchBackend('/api/state/update?zone_name=Coke Oven Battery 1', {
          method: 'POST',
          body: JSON.stringify({
            gas_readings: { o2: 20.8, co: 5.0, ch4_lfl: 6.8, h2s: 0.1, temperature: 32.5, pressure: 1.02 }
          })
        });
      } else if (type === 'Emergency Evacuation') {
        // Critical plant-wide evacuation trigger
        await fetchBackend('/api/alerts/trigger', {
          method: 'POST',
          body: JSON.stringify({
            zone: 'Coke Oven Battery 1',
            reason: 'Critical structural manifold rupture and high flammable vapor release.'
          })
        });
      } else if (type === 'Near Miss') {
        // Clear previous state first
        await fetchBackend('/api/cctv/clear?zone=Coke%20Oven%20Battery%201', { method: 'POST' });
        
        // Trigger first unauthorized entry
        this.addLogToConsole('Near Miss Simulation: Worker Arjun detected entering Coke Oven Battery 1 restricted area...');
        await fetchBackend('/api/cctv/event', {
          method: 'POST',
          body: JSON.stringify({
            zone: 'Coke Oven Battery 1',
            event_type: 'unauthorized_entry',
            confidence: 0.91,
            worker_id: 'W-001',
            worker_name: 'Arjun'
          })
        });

        // Trigger second unauthorized entry after 1.5 seconds to build near-miss prediction
        setTimeout(async () => {
          this.addLogToConsole('Near Miss Simulation: Worker Arjun repeatedly entering Coke Oven Battery 1 restricted area...');
          try {
            await fetchBackend('/api/cctv/event', {
              method: 'POST',
              body: JSON.stringify({
                zone: 'Coke Oven Battery 1',
                event_type: 'unauthorized_entry',
                confidence: 0.88,
                worker_id: 'W-001',
                worker_name: 'Arjun'
              })
            });
            this.addLogToConsole('Near Miss Simulation: System has generated a Near-Miss Prediction for Coke Oven Battery 1.');
          } catch (err) {
            console.warn('Failed to send second CCTV alert for near miss:', err);
          }
        }, 1500);
      }

      // Start continuous backend ticking to simulate live fluctuations and worker movements
      this.activeInterval = setInterval(async () => {
        if (this.isPaused) return;
        try {
          await fetchBackend('/api/simulate/tick', { method: 'POST' });
        } catch (err) {
          console.warn('Backend simulation tick failed:', err);
        }
      }, 3000);

      this.addLogToConsole(`Backend scenario ${type} running.`);
    } catch (error) {
      const isOffline = error instanceof Error && (error.message.includes('fetch') || error.message.includes('unreachable'));
      if (isOffline) {
        console.warn('ZeroHarm Backend is offline. Operating in client-side preview mode.');
        this.addLogToConsole('Safety server is offline. Running client-side preview mode.');
      } else {
        console.error('Failed to trigger backend scenario:', error);
        this.addLogToConsole(`Error triggering backend scenario: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  pause() {
    this.isPaused = true;
    this.addLogToConsole('Backend simulation ticks paused.');
  }

  resume() {
    this.isPaused = false;
    this.addLogToConsole('Backend simulation ticks resumed.');
  }

  stop() {
    if (this.activeInterval) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }
  }

  async reset() {
    this.stop();
    this.addLogToConsole('Resetting plant parameters to defaults...');
    try {
      await this.clearAllBackendAlerts();
      await this.setNominalState();
      this.addLogToConsole('Plant reset to nominal default parameters successfully.');
    } catch (error) {
      const isOffline = error instanceof Error && (error.message.includes('fetch') || error.message.includes('unreachable'));
      if (isOffline) {
        console.warn('ZeroHarm Backend is offline. Could not reset backend state.');
      } else {
        console.error('Failed to reset backend:', error);
        this.addLogToConsole('Failed to reset backend state.');
      }
    }
  }

  private async clearAllBackendAlerts() {
    const zones = ['Coke Oven Battery 1', 'Blast Furnace A', 'Sinter Plant', 'Ammonia Storage Tank'];
    for (const zone of zones) {
      try {
        await fetchBackend(`/api/cctv/clear?zone=${encodeURIComponent(zone)}`, {
          method: 'POST'
        });
      } catch (err) {
        console.warn(`Failed to clear CCTV alerts for ${zone}:`, err);
      }
    }
  }

  private async setNominalState() {
    const defaultStates = {
      "Coke Oven Battery 1": {
        gas_readings: { o2: 20.8, co: 2.5, ch4_lfl: 0.1, h2s: 0.2, temperature: 29.5, pressure: 1.01 },
        permits: [{ permit_id: "PTW-2026-001", permit_type: "hot_work", status: "active", zone: "Coke Oven Battery 1", workers_count: 3 }],
        maintenance_active: false,
        shift_changeover_active: false
      },
      "Blast Furnace A": {
        gas_readings: { o2: 20.9, co: 5.0, ch4_lfl: 0.2, h2s: 0.1, temperature: 32.0, pressure: 1.05 },
        permits: [{ permit_id: "PTW-2026-004", permit_type: "cold_work", status: "active", zone: "Blast Furnace A", workers_count: 2 }],
        maintenance_active: false,
        shift_changeover_active: false
      },
      "Sinter Plant": {
        gas_readings: { o2: 20.8, co: 1.0, ch4_lfl: 0.0, h2s: 0.0, temperature: 27.0, pressure: 0.99 },
        permits: [{ permit_id: "PTW-2026-002", permit_type: "confined_space", status: "active", zone: "Sinter Plant", workers_count: 2 }],
        maintenance_active: true,
        shift_changeover_active: false
      },
      "Ammonia Storage Tank": {
        gas_readings: { o2: 20.8, co: 0.5, ch4_lfl: 0.0, h2s: 1.5, temperature: 25.0, pressure: 1.10 },
        permits: [{ permit_id: "PTW-2026-003", permit_type: "height_work", status: "active", zone: "Ammonia Storage Tank", workers_count: 4 }],
        maintenance_active: false,
        shift_changeover_active: false
      }
    };

    for (const [zone, state] of Object.entries(defaultStates)) {
      try {
        await fetchBackend(`/api/state/update?zone_name=${encodeURIComponent(zone)}`, {
          method: 'POST',
          body: JSON.stringify(state)
        });
      } catch (err) {
        throw new Error('Backend server is unreachable.');
      }
    }
  }

  private addLogToConsole(text: string) {
    const store = typeof window !== 'undefined' 
      ? require('../hooks/useIncident').useIncident.getState()
      : null;
    if (store) {
      store.logEvent({
        type: 'EmergencyDeclared',
        payload: { message: `[SYSTEM LOG] ${text}` }
      });
    }
  }
}

export const scenarioEngine = new ScenarioEngine();
export type { ScenarioEngine };
