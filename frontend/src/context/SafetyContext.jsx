import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const SafetyContext = createContext();

const ZONES = {
  'coke-oven': { id: 'coke-oven', name: 'Coke Oven Battery 4', colorClass: 'safe' },
  'blast-furnace': { id: 'blast-furnace', name: 'Blast Furnace 2', colorClass: 'safe' },
  'gas-mixing': { id: 'gas-mixing', name: 'Gas Mixing Station', colorClass: 'safe' },
  'chemical-storage': { id: 'chemical-storage', name: 'Chemical Storage Area', colorClass: 'safe' },
  'control-room': { id: 'control-room', name: 'Main Control Room', colorClass: 'safe' },
};

const INITIAL_TELEMETRY = {
  'coke-oven': { co: 4.2, ch4: 1.1, o2: 20.8, temp: 48.5, pressure: 1.02 },
  'blast-furnace': { co: 8.5, ch4: 0.5, o2: 20.9, temp: 85.0, pressure: 2.15 },
  'gas-mixing': { co: 2.1, ch4: 3.2, o2: 20.6, temp: 32.4, pressure: 0.98 },
  'chemical-storage': { co: 0.2, ch4: 0.0, o2: 20.9, temp: 24.1, pressure: 1.00 },
  'control-room': { co: 0.0, ch4: 0.0, o2: 20.9, temp: 22.0, pressure: 1.00 },
};

const INITIAL_PERMITS = [
  { id: 'PTW-402', type: 'hot-work', zone: 'coke-oven', description: 'Welding and structural repair of coke guide rail', worker: 'Ravi Kumar (ID: W-104)', status: 'active', issuedAt: '16:00', duration: '4 hrs' },
  { id: 'PTW-405', type: 'confined-space', zone: 'gas-mixing', description: 'Internal inspection of mixing vessel V-201', worker: 'Amit Sharma (ID: W-211)', status: 'active', issuedAt: '17:30', duration: '2 hrs' },
  { id: 'PTW-409', type: 'height-work', zone: 'blast-furnace', description: 'Sensors replacement on high platform', worker: 'Sunil Verma (ID: W-118)', status: 'pending', issuedAt: '19:00', duration: '3 hrs' },
];

const INITIAL_WORKERS = [
  { id: 'W-104', name: 'Ravi Kumar', zone: 'coke-oven', heartRate: 78, gasSensorBadge: 'active' },
  { id: 'W-211', name: 'Amit Sharma', zone: 'gas-mixing', heartRate: 82, gasSensorBadge: 'active' },
  { id: 'W-118', name: 'Sunil Verma', zone: 'control-room', heartRate: 72, gasSensorBadge: 'inactive' },
  { id: 'W-302', name: 'Pooja Patil', zone: 'control-room', heartRate: 68, gasSensorBadge: 'active' },
];

export const SafetyProvider = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [telemetry, setTelemetry] = useState(INITIAL_TELEMETRY);
  const [permits, setPermits] = useState(INITIAL_PERMITS);
  const [workers, setWorkers] = useState(INITIAL_WORKERS);
  const [logs, setLogs] = useState([]);
  const [complianceScore, setComplianceScore] = useState(94);
  const [activeView, setActiveView] = useState('dashboard');
  
  // Emergency Orchestrator State
  const [emergency, setEmergency] = useState({
    active: false,
    triggerSource: '',
    timestamp: '',
    sirensActivated: false,
    teamsAlerted: false,
    valvesIsolated: false,
    evacCount: 0,
    evacTotal: INITIAL_WORKERS.length,
    reportGenerated: false,
    reportText: '',
  });

  const logsEndRef = useRef(null);

  // Helper to append agent log
  const addLog = (agent, message, status = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev.slice(-99), // Keep last 100 logs
      { time, agent, message, status },
    ]);
  };

  // Trigger Emergency Protocol
  const triggerEmergency = (source) => {
    if (emergency.active) return;
    
    const timeStr = new Date().toLocaleTimeString();
    const dateStr = new Date().toLocaleDateString();
    
    setEmergency((prev) => ({
      ...prev,
      active: true,
      triggerSource: source,
      timestamp: `${dateStr} ${timeStr}`,
      sirensActivated: true,
    }));

    addLog('RiskEngine', `🚨 EMERGENCY EVACUATION TRIGGERED. Source: ${source}`, 'critical');
    addLog('SensorAgent', '📢 Activating plant-wide sirens and visual warning alerts.', 'critical');
    
    // Simulate steps in emergency orchestration
    setTimeout(() => {
      setEmergency((prev) => ({ ...prev, teamsAlerted: true }));
      addLog('PermitAgent', '📞 Automated dispatch: Emergency response team and fire services alerted with incident location data.', 'warning');
    }, 1500);

    setTimeout(() => {
      setEmergency((prev) => ({ ...prev, valvesIsolated: true }));
      addLog('SensorAgent', '🔒 Command Sent: Solenoid shut-off isolation valves (SCADA) for Gas Lines G-12/G-14 are CLOSED.', 'critical');
    }, 3000);

    // Evacuate workers
    setTimeout(() => {
      setWorkers((prev) => prev.map(w => ({ ...w, zone: 'control-room', heartRate: 95 })));
      setEmergency((prev) => ({ ...prev, evacCount: prev.evacTotal }));
      addLog('GeoAgent', '🏃 Worker Geolocation: All badges registered at Safe Muster Station (Main Control Room). Evacuation 100% complete.', 'info');
    }, 4500);

    // Generate Incident Report
    setTimeout(() => {
      const mockReport = `=====================================================
SENTINELSAFE EMERGENCY INCIDENT REPORT
=====================================================
Incident ID      : INC-2026-0707
Date/Time        : ${dateStr} ${timeStr}
Facility Zone    : ${source.includes('Coke Oven') ? 'Coke Oven Battery 4' : 'Gas Mixing Station'}
Trigger Condition: ${source}
Status           : CONTAINED / EVACUATED

CHRONOLOGY:
- T+00s: Compound Risk Engine detected critical overlap.
- T+02s: Visual & Audio Evacuation Sirens activated.
- T+15s: Automated SMS alerts dispatched to first responders.
- T+30s: Closed gas inlet valve (SCADA shut-off).
- T+45s: All worker badges accounted for at Muster Point.

REGULATORY CITATIONS:
- Factory Act 1948 Section 36 (Confined Space Protection)
- OISD-STD-105 Work Permit Compliance Audited.
=====================================================`;
      setEmergency((prev) => ({ ...prev, reportGenerated: true, reportText: mockReport }));
      addLog('RiskEngine', '📝 Regulatory incident report compiled automatically against OISD / Factory Act templates.', 'info');
    }, 6000);
  };

  // Reset simulation
  const resetSimulation = () => {
    setTelemetry(INITIAL_TELEMETRY);
    setPermits(INITIAL_PERMITS);
    setWorkers(INITIAL_WORKERS);
    setComplianceScore(94);
    setLogs([]);
    setEmergency({
      active: false,
      triggerSource: '',
      timestamp: '',
      sirensActivated: false,
      teamsAlerted: false,
      valvesIsolated: false,
      evacCount: 0,
      evacTotal: INITIAL_WORKERS.length,
      reportGenerated: false,
      reportText: '',
    });
    addLog('RiskEngine', 'Simulation initialized. Agents active. Normal telemetry monitoring.', 'info');
  };

  // Simulation Tick Loop
  useEffect(() => {
    addLog('RiskEngine', 'Safety Intelligence Agents initialized. Subscribing to IoT & PTW streams.', 'info');
    addLog('SensorAgent', 'Telemetry polling active. Monitoring CO, CH4, O2, Temp, and Pressure.', 'info');
    addLog('PermitAgent', 'Work Permit (PTW) sync completed. 2 active permits loaded.', 'info');
    addLog('GeoAgent', 'Geospatial worker badges online. Tracking 4 workers.', 'info');
  }, []);

  useEffect(() => {
    if (!isPlaying || emergency.active) return;

    const interval = setInterval(() => {
      // 1. Update Telemetry
      setTelemetry((prev) => {
        const next = { ...prev };
        
        // Coke Oven telemetry drift (gas accumulation)
        next['coke-oven'] = {
          co: +(Math.max(0.1, prev['coke-oven'].co + (Math.random() - 0.45) * 1.5)).toFixed(1),
          ch4: +(Math.max(0.0, prev['coke-oven'].ch4 + (Math.random() - 0.48) * 0.4)).toFixed(1),
          o2: +(Math.max(18.0, Math.min(21.5, prev['coke-oven'].o2 + (Math.random() - 0.5) * 0.1))).toFixed(1),
          temp: +(prev['coke-oven'].temp + (Math.random() - 0.48) * 1).toFixed(1),
          pressure: +(prev['coke-oven'].pressure + (Math.random() - 0.5) * 0.02).toFixed(2),
        };

        // Gas Mixing Station telemetry drift
        next['gas-mixing'] = {
          co: +(Math.max(0.1, prev['gas-mixing'].co + (Math.random() - 0.5) * 0.4)).toFixed(1),
          ch4: +(Math.max(0.0, prev['gas-mixing'].ch4 + (Math.random() - 0.4) * 0.8)).toFixed(1), // Methane increases faster
          o2: +(Math.max(18.0, Math.min(21.5, prev['gas-mixing'].o2 + (Math.random() - 0.5) * 0.1))).toFixed(1),
          temp: +(prev['gas-mixing'].temp + (Math.random() - 0.5) * 0.5).toFixed(1),
          pressure: +(prev['gas-mixing'].pressure + (Math.random() - 0.5) * 0.01).toFixed(2),
        };

        // Blast Furnace drift
        next['blast-furnace'] = {
          co: +(Math.max(0.1, prev['blast-furnace'].co + (Math.random() - 0.49) * 0.8)).toFixed(1),
          ch4: +(Math.max(0.0, prev['blast-furnace'].ch4 + (Math.random() - 0.5) * 0.1)).toFixed(1),
          o2: +(Math.max(18.0, Math.min(21.5, prev['blast-furnace'].o2 + (Math.random() - 0.5) * 0.1))).toFixed(1),
          temp: +(prev['blast-furnace'].temp + (Math.random() - 0.45) * 2).toFixed(1), // Temp rises
          pressure: +(prev['blast-furnace'].pressure + (Math.random() - 0.5) * 0.05).toFixed(2),
        };

        // Chemical storage drift
        next['chemical-storage'] = {
          co: +(Math.max(0.0, prev['chemical-storage'].co + (Math.random() - 0.5) * 0.05)).toFixed(1),
          ch4: 0,
          o2: +(Math.max(19.0, Math.min(21.5, prev['chemical-storage'].o2 + (Math.random() - 0.5) * 0.05))).toFixed(1),
          temp: +(prev['chemical-storage'].temp + (Math.random() - 0.5) * 0.2).toFixed(1),
          pressure: 1.00,
        };

        return next;
      });

      // Randomize worker heart rate slightly
      setWorkers((prev) =>
        prev.map((w) => {
          let delta = Math.floor((Math.random() - 0.5) * 6);
          // If in a zone where gas is rising, raise heart rate
          if (w.zone === 'coke-oven' && telemetry['coke-oven'].co > 10) {
            delta += 4;
          }
          return {
            ...w,
            heartRate: Math.max(60, Math.min(130, w.heartRate + delta)),
          };
        })
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [isPlaying, telemetry, emergency.active]);

  // 2. Compound Risk Evaluation & Agent Simulation
  useEffect(() => {
    if (!isPlaying || emergency.active) return;

    // Check Coke Oven Compound Risk
    const cokeOvenGas = telemetry['coke-oven'].co;
    const hotWorkPermit = permits.find(p => p.zone === 'coke-oven' && p.type === 'hot-work' && p.status === 'active');
    
    if (cokeOvenGas > 15.0 && hotWorkPermit) {
      // SUSPEND PERMIT AUTOMATICALLY - COMPOUND RISK ACTION
      setPermits(prev =>
        prev.map(p => (p.id === hotWorkPermit.id ? { ...p, status: 'suspended' } : p))
      );
      setComplianceScore(prev => Math.max(50, prev - 15));
      
      addLog('SensorAgent', `⚠️ Coke Oven CO level reached ${cokeOvenGas} ppm (Alarm Limit is 15.0 ppm).`, 'warning');
      addLog('PermitAgent', `🚨 Conflict Detected: Active Hot Work Permit [${hotWorkPermit.id}] in proximity of gas accumulation.`, 'critical');
      addLog('RiskEngine', `🔥 AUTOMATIC INTERVENTION: Suspended Permit [${hotWorkPermit.id}] due to explosive risk co-occurrence.`, 'critical');
      addLog('GeoAgent', `📢 Safety alert broadcasted to worker Ravi Kumar's badge: "SUSPEND WELDING IMMEDIATELY & RETREAT".`, 'critical');
      
      // Auto trigger emergency if it goes way out of hand
      if (cokeOvenGas > 22.0) {
        triggerEmergency('Sensor Spike: CO Level > 22ppm in Coke Oven during Welding repairs');
      }
    } else if (cokeOvenGas > 12.0 && hotWorkPermit && telemetry['coke-oven'].ch4 > 2.0) {
      addLog('RiskEngine', '⚠️ Pre-emptive Warning: Gas concentrations rising near welding guide rails. Recommending purge ventilation.', 'warning');
    }

    // Check Gas Mixing Station Confined Space Risk
    const gasMixingCH4 = telemetry['gas-mixing'].ch4;
    const confinedSpacePermit = permits.find(p => p.zone === 'gas-mixing' && p.type === 'confined-space' && p.status === 'active');
    
    if (gasMixingCH4 > 6.0 && confinedSpacePermit) {
      setPermits(prev =>
        prev.map(p => (p.id === confinedSpacePermit.id ? { ...p, status: 'suspended' } : p))
      );
      setComplianceScore(prev => Math.max(50, prev - 20));
      
      addLog('SensorAgent', `⚠️ Gas Mixing Station CH4 Level reached ${gasMixingCH4}% LEL (Confined Space Threshold is 5.0% LEL).`, 'warning');
      addLog('PermitAgent', `🚨 Conflict: Active Confined Space Entry [${confinedSpacePermit.id}] during abnormal methane accumulation.`, 'critical');
      addLog('RiskEngine', `🔥 AUTOMATIC INTERVENTION: Suspended Permit [${confinedSpacePermit.id}] immediately. Command sent to ventilation fans.`, 'critical');
      addLog('GeoAgent', `🏃 Geo-alert dispatched to Amit Sharma inside Mixer Vessel V-201: EVACUATE IMMEDIATELY.`, 'critical');

      if (gasMixingCH4 > 10.0) {
        triggerEmergency(`Gas Leak: CH4 Level ${gasMixingCH4}% LEL in Confined Space entry area`);
      }
    }

    // Check Worker entry without sensor badge
    const workerWithoutBadge = workers.find(w => w.zone !== 'control-room' && w.gasSensorBadge === 'inactive');
    if (workerWithoutBadge) {
      setComplianceScore(prev => Math.max(50, prev - 5));
      addLog('GeoAgent', `⚠️ Worker ${workerWithoutBadge.name} detected in ${ZONES[workerWithoutBadge.zone].name} without active gas sensor badge logging!`, 'warning');
      addLog('RiskEngine', '📋 Compliance audit alert: statutory breach of Factory Act Sec 36. Raising inspector check request.', 'warning');
      
      // Auto-remedy
      setWorkers(prev => prev.map(w => w.id === workerWithoutBadge.id ? { ...w, gasSensorBadge: 'active' } : w));
      addLog('RiskEngine', `🔧 Self-remediation: Remotely activated backup gas sensor badge logging for ${workerWithoutBadge.name}.`, 'info');
    }

  }, [telemetry, permits, workers, isPlaying]);

  // Zone status mapper
  const getZoneStatus = (zoneId) => {
    if (emergency.active && zoneId === emergency.triggerSource) return 'critical';
    
    const t = telemetry[zoneId];
    if (!t) return 'safe';
    
    const activeHotPermit = permits.some(p => p.zone === zoneId && p.type === 'hot-work' && p.status === 'active');
    const activeConfinedPermit = permits.some(p => p.zone === zoneId && p.type === 'confined-space' && p.status === 'active');

    // Coke Oven critical
    if (zoneId === 'coke-oven') {
      if (t.co > 15.0 || (t.co > 10.0 && activeHotPermit)) return 'critical';
      if (t.co > 8.0 || activeHotPermit) return 'warning';
    }
    // Gas mixing critical
    if (zoneId === 'gas-mixing') {
      if (t.ch4 > 6.0 || (t.ch4 > 4.0 && activeConfinedPermit)) return 'critical';
      if (t.ch4 > 3.0 || activeConfinedPermit) return 'warning';
    }
    // Blast furnace critical
    if (zoneId === 'blast-furnace') {
      if (t.co > 25.0 || t.temp > 100) return 'critical';
      if (t.co > 15.0 || t.temp > 80) return 'warning';
    }

    return 'safe';
  };

  // Inject demo scenarios
  useEffect(() => {
    window.injectScenario = (scenarioId) => {
      if (scenarioId === 'coke-oven-leak') {
        setIsPlaying(false);
        setTelemetry((prev) => ({
          ...prev,
          'coke-oven': { ...prev['coke-oven'], co: 18.5, ch4: 2.5, temp: 58.0 }
        }));
        addLog('RiskEngine', '🚨 DEMO TRIGGER: Injected Carbon Monoxide leak of 18.5 ppm in Coke Oven Battery.', 'critical');
      } else if (scenarioId === 'gas-mixing-leak') {
        setIsPlaying(false);
        setTelemetry((prev) => ({
          ...prev,
          'gas-mixing': { ...prev['gas-mixing'], ch4: 8.2 }
        }));
        addLog('RiskEngine', '🚨 DEMO TRIGGER: Injected Methane leak of 8.2% LEL in Gas Mixing Station.', 'critical');
      } else if (scenarioId === 'unbadge-worker') {
        setWorkers((prev) => [
          ...prev,
          { id: 'W-400', name: 'Karan Singh', zone: 'blast-furnace', heartRate: 75, gasSensorBadge: 'inactive' }
        ]);
        addLog('RiskEngine', '🚨 DEMO TRIGGER: Injected worker Karan Singh entering Blast Furnace zone without active safety badge.', 'warning');
      }
    };
    return () => {
      delete window.injectScenario;
    };
  }, []);

  return (
    <SafetyContext.Provider
      value={{
        isPlaying,
        setIsPlaying,
        telemetry,
        setTelemetry,
        permits,
        setPermits,
        workers,
        setWorkers,
        logs,
        addLog,
        complianceScore,
        setComplianceScore,
        activeView,
        setActiveView,
        getZoneStatus,
        emergency,
        triggerEmergency,
        resetSimulation,
        zones: ZONES,
      }}
    >
      {children}
    </SafetyContext.Provider>
  );
};

export const useSafety = () => useContext(SafetyContext);
