'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import RiskGauge from '../../component/RiskGauge';
import { useShallow } from 'zustand/react/shallow';
import { 
  useIncident,
  selectPlantSafetyRating,
  selectOverallRisk,
  selectOpenIncidentCount,
  selectCompliancePercentage,
  selectActiveWorkers,
  selectPlantAStats,
  selectPlantBStats,
  selectPlantCStats
} from '../../hooks/useIncident';
import { 
  Users, 
  FileWarning, 
  BookCheck, 
  Activity, 
  Wrench, 
  ShieldAlert, 
  CheckSquare, 
  Shield,
  Gauge
} from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { addToast } = useNotifications();

  // central raw store telemetry values
  const telemetry = useIncident(state => state.telemetry);
  const alerts = useIncident(state => state.alerts);
  const activePermits = useIncident(state => state.activePermits);
  const aiReasoning = useIncident(state => state.aiReasoning);
  const emergencyMode = useIncident(state => state.emergencyMode);
  const evacuationMessage = useIncident(state => state.evacuationMessage);

  // computed derived selectors
  const safetyRating = useIncident(selectPlantSafetyRating);
  const overallRisk = useIncident(selectOverallRisk);
  const openIncidentCount = useIncident(selectOpenIncidentCount);
  const compliancePercentage = useIncident(selectCompliancePercentage);
  const activeWorkersCount = useIncident(selectActiveWorkers);

  const [selectedPlant, setSelectedPlant] = useState<'A' | 'B' | 'C'>('A');
  const plantAStats = useIncident(selectPlantAStats);
  const plantBStats = useIncident(selectPlantBStats);
  const plantCStats = useIncident(selectPlantCStats);

  const plantStats = {
    A: plantAStats,
    B: plantBStats,
    C: plantCStats
  };

  const handleResolveAction = (title: string) => {
    addToast(`Initiated dispatch: ${title}`, 'success');
  };

  if (authLoading) {
    return (
      <div className="flex flex-col gap-6 py-8 animate-pulse">
        <div className="h-10 bg-white/5 rounded-xl w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center max-w-md mx-auto py-12">
        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-safety-orange mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="font-heading text-lg font-bold text-white mb-2">Gatehouse Verification Required</h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">
          You must log into the platform gateway to view refinery safety telemetry details.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="bg-safety-orange text-white font-semibold text-xs px-6 py-2.5 rounded-xl hover:bg-safety-orange/90 transition-colors cursor-pointer"
        >
          Proceed to Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-4">
      
      {/* Emergency Mode Alert Banner */}
      {emergencyMode && (
        <div className="bg-red-500/10 border-2 border-red-500 text-red-200 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
          <ShieldAlert className="w-6 h-6 text-red-500" />
          <div>
            <h4 className="font-bold text-sm font-heading">PLANT EVACUATION SIRENS ACTIVE</h4>
            <p className="text-xs text-red-300 mt-0.5">{evacuationMessage}</p>
          </div>
        </div>
      )}

      {/* Welcome Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">
            OPERATIONS DESK
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Safety Operations Center
          </h1>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-slate-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
          <span>CONNECTED SECTORS: 3 / 3</span>
        </div>
      </div>

      {/* KPI Stats (Clean matte elevated panels) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Plant Safety Rating', val: `${safetyRating}%`, icon: Wrench, color: 'text-green-400' },
          { label: 'Active Crew On-site', val: activeWorkersCount, icon: Users, color: 'text-blue-400' },
          { label: 'Open Safety Inquiries', val: openIncidentCount, icon: FileWarning, color: 'text-amber-400 animate-pulse' },
          { label: 'OISD Audit Level', val: `${compliancePercentage}%`, icon: BookCheck, color: 'text-emerald-400' }
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:bg-white/[0.04] transition-all">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">{kpi.label}</span>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <h2 className="font-heading text-2xl font-bold text-white tracking-tight">
                {kpi.val}
              </h2>
            </div>
          );
        })}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Plant Overview & Live Map (Left/Center Column) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Spatial Selector Panel */}
          <div className="glass-panel border border-white/10 rounded-3xl p-6 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="font-heading text-base font-bold text-white tracking-wide">Plant Telemetry Monitor</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Select plant segment to filter sensors</p>
              </div>

              {/* Plant Switchers */}
              <div className="flex gap-2">
                {(['A', 'B', 'C'] as const).map((seg) => (
                  <button
                    key={seg}
                    onClick={() => setSelectedPlant(seg)}
                    className={`px-3 py-1 text-xs font-mono font-semibold rounded-lg border transition-all ${
                      selectedPlant === seg 
                        ? 'bg-safety-orange border-safety-orange text-white' 
                        : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Plant {seg}
                  </button>
                ))}
              </div>
            </div>

            {/* Plant Stats display */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-black/35 border border-white/5 rounded-2xl p-5">
              <div className="flex flex-col items-center justify-center p-3 text-center border-b sm:border-b-0 sm:border-r border-white/5">
                <RiskGauge score={plantStats[selectedPlant].safety} size={130} />
              </div>

              <div className="sm:col-span-2 flex flex-col justify-between py-2 pl-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">SEGMENT DETAILS</span>
                  <h4 className="font-heading text-lg font-bold text-white mt-1">
                    {plantStats[selectedPlant].name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed font-mono text-[11px]">
                    {plantStats[selectedPlant].details}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 border-t border-white/5 pt-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block">CREW COUNT</span>
                    <span className="text-sm font-bold text-white">{plantStats[selectedPlant].crew} Personnel</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block">OPEN HAZARDS</span>
                    <span className="text-sm font-bold text-amber-400">{plantStats[selectedPlant].hazards} Inquiries</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* AI Explainable Fusion Reasoning */}
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-safety-orange" />
              <h3 className="font-heading text-base font-bold text-white tracking-wide">
                Agentic Risk Fusion Diagnosis
              </h3>
            </div>
            
            <div className="flex flex-col gap-4 text-xs text-slate-300">
              <p className="leading-relaxed bg-black/25 border border-white/5 p-4 rounded-xl font-mono text-[11px] border-l-4 border-l-safety-orange">
                {aiReasoning.reasoning}
              </p>

              <div>
                <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider block mb-2">
                  AI RECOMMENDATIONS WORKLIST
                </span>
                <div className="flex flex-col gap-2">
                  {aiReasoning.recommendations.map((rec, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/5 border border-white/5 p-3 rounded-lg">
                      <span className="font-medium text-slate-300">{rec}</span>
                      <button
                        onClick={() => handleResolveAction(rec)}
                        className="text-xs text-safety-orange hover:underline font-semibold cursor-pointer"
                      >
                        Dispatch Task
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Real-time Alert Ticker (Right Column) */}
        <div className="flex flex-col gap-6">
          <div className="glass-panel border border-white/10 rounded-3xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-heading text-base font-bold text-white tracking-wide">
                  Live Alert Stream
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Telemetry warning logs</p>
              </div>
              <Activity className="w-4 h-4 text-safety-orange animate-pulse" />
            </div>

            <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-10">No alerts active. All segments nominal.</p>
              ) : (
                alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`p-4 rounded-xl border flex flex-col gap-2 ${
                      alert.severity === 'Critical' 
                        ? 'bg-red-500/5 border-red-500/15 text-red-400' 
                        : alert.severity === 'Warning' 
                        ? 'bg-amber-500/5 border-amber-500/15 text-amber-400' 
                        : 'bg-blue-500/5 border-blue-500/15 text-blue-400'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold font-mono uppercase tracking-wider">{alert.department}</span>
                      <span className="text-[9px] font-mono text-slate-500">
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans font-medium">
                      {alert.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
