'use client';

import React, { useState, useEffect } from 'react';
import { useIncident } from '../hooks/useIncident';
import { scenarioEngine, ScenarioType } from '../services/scenarioEngine';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Sliders, 
  Terminal, 
  ChevronRight, 
  ChevronDown, 
  Bot,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ScenarioConsole() {
  const eventLogs = useIncident(state => state.eventLogs);
  const [isOpen, setIsOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState<ScenarioType>('Normal');
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Start Normal operations by default
    scenarioEngine.startScenario('Normal');
  }, []);

  const handleStart = (type: ScenarioType) => {
    setActiveScenario(type);
    setIsPaused(false);
    scenarioEngine.startScenario(type);
  };

  const handlePauseToggle = () => {
    if (isPaused) {
      scenarioEngine.resume();
    } else {
      scenarioEngine.pause();
    }
    setIsPaused(!isPaused);
  };

  const handleReset = () => {
    setActiveScenario('Normal');
    setIsPaused(false);
    scenarioEngine.reset();
    scenarioEngine.startScenario('Normal');
  };

  // Human readable event descriptions
  const getEventText = (event: any) => {
    if (event.payload && event.payload.message && event.payload.message.startsWith('[SYSTEM LOG]')) {
      return event.payload.message;
    }

    switch (event.type) {
      case 'GasReadingUpdated':
        return `Sensor Updated: ${event.payload.zone} hydrocarbon concentration is ${event.payload.lel}% LEL`;
      case 'PressureReadingUpdated':
        return `Sensor Updated: ${event.payload.line} pressure is ${event.payload.pressure} bar`;
      case 'TemperatureUpdated':
        return `Sensor Updated: ${event.payload.area} temp is ${event.payload.temp}°C`;
      case 'WorkerEnteredZone':
        return `Vision Alert: Worker ${event.payload.workerName} entered ${event.payload.zone}`;
      case 'WorkerExitedZone':
        return `Vision Alert: Worker #${event.payload.workerId} exited segment`;
      case 'PPEViolationDetected':
        return `PPE Breach: ${event.payload.workerName} missing hard hat/web harness in ${event.payload.zone}`;
      case 'PermitIssued':
        return `Permit Approved: ${event.payload.permitType} permit registered for ${event.payload.zone}`;
      case 'PermitRevoked':
        return `Permit Revoked: Permit #${event.payload.permitId} closed`;
      case 'EquipmentFaultDetected':
        return `Telemetry Alert: ${event.payload.equipId} reports fault - ${event.payload.fault}`;
      case 'MaintenanceStarted':
        return `Crew Dispatched: Maintenance started on ${event.payload.equipId}`;
      case 'IncidentCreated':
        return `Breach Logged: Incident ${event.payload.id} - ${event.payload.title}`;
      case 'IncidentResolved':
        return `Case Resolved: Incident ${event.payload.id} resolved by operator`;
      case 'ComplianceViolationDetected':
        return `Regulation Variance: Standard ${event.payload.standardName} fails check`;
      case 'EmergencyDeclared':
        return `Siren Triggered: Emergency evacuation warning - ${event.payload.message}`;
      case 'EmergencyCleared':
        return `All Clear: Emergency evacuation sirens reset`;
      case 'AlertAcknowledged':
        return `Alert Cleared: Acknowledged by operator`;
      case 'SimulationReset':
        return 'System Reset: Telemetry baseline loaded';
      default:
        return `Event Emitted: ${event.type}`;
    }
  };

  const getEventColor = (event: any) => {
    if (event.payload && event.payload.message && event.payload.message.startsWith('[SYSTEM LOG]')) {
      return 'text-sky-400 font-semibold';
    }

    switch (event.type) {
      case 'EmergencyDeclared':
      case 'IncidentCreated':
      case 'ComplianceViolationDetected':
        return 'text-red-400 font-medium';
      case 'PPEViolationDetected':
      case 'EquipmentFaultDetected':
        return 'text-amber-400';
      case 'GasReadingUpdated':
        return event.payload.lel > 10 ? 'text-amber-400' : 'text-slate-400';
      case 'PressureReadingUpdated':
        return event.payload.pressure > 11.5 ? 'text-amber-400' : 'text-slate-400';
      case 'IncidentResolved':
      case 'EmergencyCleared':
      case 'SimulationReset':
        return 'text-green-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/90 text-slate-200 border border-white/10 hover:text-white hover:bg-slate-800 transition-all shadow-xl shadow-black/30 font-mono text-xs focus:outline-none cursor-pointer"
        suppressHydrationWarning
      >
        <Sliders className="w-4 h-4 text-safety-orange" />
        <span>Scenario Console</span>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      {/* Console Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="mt-3 w-80 sm:w-[450px] glass-panel border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-stretch"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5 flex justify-between items-center text-xs">
              <span className="font-heading font-semibold text-slate-300 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-safety-orange" />
                <span>Developer Scenario Console</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">EMITTING VIA EVENT BUS</span>
            </div>

            {/* Scenario selectors */}
            <div className="p-4 border-b border-white/5 flex flex-col gap-3">
              <div>
                <label className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block mb-2">
                  Select Active Timeline Scenario
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    'Normal', 
                    'Gas Leak', 
                    'PPE Breach', 
                    'Machine Overheating', 
                    'Confined Space', 
                    'Compound Risk'
                  ].map((sc) => (
                    <button
                      key={sc}
                      onClick={() => handleStart(sc as any)}
                      className={`py-1.5 px-2 rounded-lg border text-[10px] font-mono font-semibold transition-all text-left truncate cursor-pointer ${
                        activeScenario === sc 
                          ? 'bg-safety-orange border-safety-orange text-white' 
                          : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                      suppressHydrationWarning
                    >
                      {sc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulation controls */}
              <div className="flex gap-2 border-t border-white/5 pt-3">
                <button
                  onClick={handlePauseToggle}
                  className="flex-1 py-2 rounded-lg bg-white/5 border border-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-all font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  suppressHydrationWarning
                >
                  {isPaused ? <Play className="w-3.5 h-3.5 text-green-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 py-2 rounded-lg bg-white/5 border border-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-all font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  suppressHydrationWarning
                >
                  <RefreshCw className="w-3.5 h-3.5 text-safety-orange" />
                  <span>RESET PLANT</span>
                </button>
              </div>
            </div>

            {/* Live Ticker log */}
            <div className="p-4 bg-black/45 flex flex-col items-stretch max-h-56">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider mb-2 flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                <span>Live Event Stream Log</span>
              </span>

              <div className="flex-1 overflow-y-auto divide-y divide-white/5 pr-1 flex flex-col gap-1 max-h-40">
                {eventLogs.length === 0 ? (
                  <span className="text-[10px] text-slate-600 font-mono italic p-2">Waiting for pipeline logs...</span>
                ) : (
                  eventLogs.map((log, idx) => (
                    <div key={idx} className="py-1.5 text-[10px] font-mono leading-relaxed">
                      <span className="text-slate-500 mr-1.5">[BUS]</span>
                      <span className={getEventColor(log)}>{getEventText(log)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
