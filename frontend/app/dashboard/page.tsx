'use client';

import React, { useState, useEffect } from 'react';
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
import Modal from '../../component/Modal';
import { fetchBackend } from '../../services/api';
import { eventBus } from '../../lib/eventBus';
import { 
  Users, 
  FileWarning, 
  BookCheck, 
  Activity, 
  Wrench, 
  ShieldAlert, 
  CheckSquare, 
  Shield,
  Gauge,
  BrainCircuit,
  ShieldAlert as ShieldAlertIcon,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);
  const { addToast } = useNotifications();

  // central raw store telemetry values
  const telemetry = useIncident(state => state.telemetry);
  const alerts = useIncident(state => state.alerts);
  const activePermits = useIncident(state => state.activePermits);
  const aiReasoning = useIncident(state => state.aiReasoning);
  const emergencyMode = useIncident(state => state.emergencyMode);
  const evacuationMessage = useIncident(state => state.evacuationMessage);
  const nearMisses = useIncident(state => state.nearMisses);
  const wsConnected = useIncident(state => state.wsConnected);

  // computed derived selectors
  const safetyRating = useIncident(selectPlantSafetyRating);
  const overallRisk = useIncident(selectOverallRisk);
  const openIncidentCount = useIncident(selectOpenIncidentCount);
  const compliancePercentage = useIncident(selectCompliancePercentage);
  const activeWorkersCount = useIncident(selectActiveWorkers);

  const [selectedPlant, setSelectedPlant] = useState<'A'>('A');
  const plantAStats = useIncident(selectPlantAStats);

  const [isDebateModalOpen, setIsDebateModalOpen] = useState(false);
  const [isDebating, setIsDebating] = useState(false);
  const [debateResult, setDebateResult] = useState<any>(null);
  const NEAR_MISS_DISPLAY_LIMIT = 5;

  const generateLocalDashboardDebate = (zone: string) => {
    const isCoke = zone.toLowerCase().includes('coke') || zone.toLowerCase().includes('battery');
    const isSinter = zone.toLowerCase().includes('sinter');
    
    let riskProbability = 8;
    let prediction = "No immediate safety threats predicted. Plant operations nominal.";
    let factors = ["All Sensors Reporting Green", "Permits Audited & Compliant"];
    let finalConsensus = "All agents agree that parameters are currently within normal compliance thresholds.";
    let recommendations = ["Maintain standard safety patrol rounds."];
    let debateTranscript: any[] = [];

    if (isCoke) {
      riskProbability = 96;
      prediction = "Explosion possible within 18 minutes.";
      factors = ["Methane Leakage Accumulation", "Active Spark-Producing Hot Work", "Atmospheric Ventilation Stagnation"];
      finalConsensus = "CRITICAL HAZARD DECLARED: Positive flammability slope overlaps with active Hot Work (welding) and valve maintenance under stagnant wind conditions. Immediate explosion risk.";
      recommendations = [
        "ENGAGE SIRENS: Evacuate Coke Oven Battery 1 immediately.",
        "HALT PERMITS: Revoke Hot Work permit PTW-HW-202 immediately.",
        "ISOLATE PROCESS: Close ESD valves upstream of maintenance segment."
      ];
      debateTranscript = [
        { agent_id: 'gas_agent', agent_name: 'Gas Sensor Monitoring Agent', role: 'IoT Telemetry Analysis', round: 1, message: 'Methane LFL has increased to 6.8%. The accumulation rate is positive. High flammability slope detected.', sentiment: 'critical' },
        { agent_id: 'maintenance_agent', agent_name: 'Maintenance Intelligence Agent', role: 'Valve/Asset Operations', round: 1, message: 'Maintenance is active on the valve line. Seals are currently unseated.', sentiment: 'warning' },
        { agent_id: 'permit_agent', agent_name: 'Permit Compliance Agent', role: 'Work Permit Auditor', round: 1, message: 'Permit PTW-HW-202 (Hot Work) is active for welding near the manifold deck. Spark hazard present.', sentiment: 'warning' },
        { agent_id: 'weather_agent', agent_name: 'Environmental Weather Agent', role: 'Micro-climate Monitor', round: 1, message: 'Wind speed has decreased to 1.8 m/s. Stagnant air pocket. Gas will not disperse naturally.', sentiment: 'warning' },
        { agent_id: 'cctv_agent', agent_name: 'CCTV Computer Vision Agent', role: 'Visual Security Analytics', round: 1, message: 'CCTV confirms two workers are on the manifold deck holding welding gear.', sentiment: 'warning' },
        { agent_id: 'gas_agent', agent_name: 'Gas Sensor Monitoring Agent', role: 'IoT Telemetry Analysis', round: 2, message: 'The methane leak is accelerating. Sparks from welding will exceed the Lower Flammable Limit ignition threshold.', sentiment: 'critical' },
        { agent_id: 'permit_agent', agent_name: 'Permit Compliance Agent', role: 'Work Permit Auditor', round: 2, message: 'Under OISD-STD-105 standards, hot work is strictly banned above 4% LFL. Critical breach!', sentiment: 'critical' },
        { agent_id: 'coordinator_agent', agent_name: 'Safety Coordinator Agent', role: 'Orchestration & Consensus', round: 3, message: 'Consensus: Methane rising + Active Welding + Stagnant Air. Risk Probability = 96%. Prediction: Explosion possible within 18 minutes. Triggering evacuation.', sentiment: 'critical' }
      ];
    } else if (isSinter) {
      riskProbability = 92;
      prediction = "Asphyxiation / unconsciousness possible within 6 minutes.";
      factors = ["Oxygen Depletion (<16%)", "Active Confined Space Permit", "Poor Ventilation"];
      finalConsensus = "CRITICAL HEALTH THREAT: Oxygen level has dropped to 15.8% inside the confined space. Standby watchperson is outside, but workers are inside without positive-pressure air hoses.";
      recommendations = [
        "RESCUE MISSION: Dispatch standby rescue team with breathing apparatus and lifeline harness.",
        "VENTILATE: Activate forced-draft ventilation fans immediately."
      ];
      debateTranscript = [
        { agent_id: 'gas_agent', agent_name: 'Gas Sensor Monitoring Agent', role: 'IoT Telemetry Analysis', round: 1, message: 'Oxygen concentration is down to 15.8% inside the Sinter Plant hopper.', sentiment: 'critical' },
        { agent_id: 'permit_agent', agent_name: 'Permit Compliance Agent', role: 'Work Permit Auditor', round: 1, message: 'Confined space permit PTW-CS-101 is active. Two engineers are inside for cleaning.', sentiment: 'warning' },
        { agent_id: 'cctv_agent', agent_name: 'CCTV Computer Vision Agent', role: 'Visual Security Analytics', round: 1, message: 'Workers are inside without positive-pressure air hoses.', sentiment: 'warning' },
        { agent_id: 'coordinator_agent', agent_name: 'Safety Coordinator Agent', role: 'Orchestration & Consensus', round: 3, message: 'Consensus: Oxygen is at 15.8%, workers trapped in confined space. Risk Probability = 92%. Prediction: Asphyxiation within 6 minutes.', sentiment: 'critical' }
      ];
    } else {
      riskProbability = 45;
      prediction = "Blast Furnace pressure surge possible within 30 minutes.";
      factors = ["Pressure Transients Up 8%", "Cooling Water Temp Elevated"];
      finalConsensus = "ELEVATED ALERT: Furnace top pressure shows minor positive fluctuations. Hot metal tapping permit active. Monitor cooling stave temperature.";
      recommendations = [
        "MONITOR: Check stave thermometer arrays every 10 minutes.",
        "VENT: Open bleed valve slightly if top pressure exceeds 2.8 bar."
      ];
      debateTranscript = [
        { agent_id: 'gas_agent', agent_name: 'Gas Sensor Monitoring Agent', role: 'IoT Telemetry Analysis', round: 1, message: 'Furnace top pressure is 2.55 bar, showing 8% positive slope.', sentiment: 'warning' },
        { agent_id: 'maintenance_agent', agent_name: 'Maintenance Intelligence Agent', role: 'Valve/Asset Operations', round: 1, message: 'Bleeder valves were inspected last week. Full mechanical travel verified.', sentiment: 'nominal' },
        { agent_id: 'coordinator_agent', agent_name: 'Safety Coordinator Agent', role: 'Orchestration & Consensus', round: 2, message: 'Consensus: Pressure rising but controllable. Risk Probability = 45%. Monitoring active.', sentiment: 'warning' }
      ];
    }

    return {
      zone,
      timestamp: new Date().toISOString(),
      risk_probability: riskProbability,
      prediction,
      compound_factors: factors,
      debate_transcript: debateTranscript,
      final_consensus: finalConsensus,
      recommendations,
      weather_info: { wind_speed_m_s: 2.1, wind_direction: 'SSE', humidity: 75, ambient_temp_c: 32, ventilation_status: 'Stagnant' },
      mode: 'Local Simulation Preview'
    };
  };

  const handleRunDebate = async () => {
    setIsDebating(true);
    const zone = plantStats[selectedPlant].zone;

    try {
      const response = await fetchBackend<any>('/api/collaborative-reasoning/debate', {
        method: 'POST',
        body: JSON.stringify({ zone })
      });
      if (response) {
        setDebateResult(response);
        setIsDebateModalOpen(true);
        addToast(`Debate completed for ${zone}! Risk index: ${response.risk_probability}%`, 'success');
      }
    } catch (error) {
      console.warn('Backend offline, running local debate simulation.', error);
      const localDebate = generateLocalDashboardDebate(zone);
      setDebateResult(localDebate);
      setIsDebateModalOpen(true);
      addToast(`Simulation: Debate completed for ${zone}! Risk index: ${localDebate.risk_probability}%`, 'info');
    } finally {
      setIsDebating(false);
    }
  };

  const plantStats = {
    A: plantAStats
  };

  const handleResolveAction = async (title: string) => {
    addToast(`Initiated dispatch: ${title}`, 'success');
    
    const zone = debateResult?.zone || 'Coke Oven Battery 1';
    const titleLower = title.toLowerCase();

    // 1. If it's an evacuation directive, trigger emergency mode in the store
    if (titleLower.includes('evacuate') || titleLower.includes('sirens') || titleLower.includes('siren')) {
      useIncident.getState().setEmergency(true, `Evacuation ordered: ${title}`);
      eventBus.publish({
        type: 'EmergencyDeclared',
        payload: { message: title }
      });
    }
    
    // 2. If it's a permit revocation directive, publish PermitRevoked
    else if (titleLower.includes('revoke') || titleLower.includes('permit')) {
      const match = title.match(/PTW-[A-Z0-9-]+/i);
      const permitId = match ? match[0] : 'PTW-HW-202';
      eventBus.publish({
        type: 'PermitRevoked',
        payload: { permitId }
      });
    }

    // 3. If it's an isolation directive
    else if (titleLower.includes('isolate') || titleLower.includes('close')) {
      eventBus.publish({
        type: 'EquipmentFaultDetected',
        payload: { equipId: 'ESD Valve', line: zone, fault: 'Isolating Line Segment' }
      });
    }

    // 4. Default Crew Dispatch
    else {
      eventBus.publish({
        type: 'MaintenanceStarted',
        payload: {
          equipId: 'Safety Rescue Squad',
          task: title
        }
      });
    }

    // 5. Drone inspection integration
    if (titleLower.includes('drone') || titleLower.includes('inspect') || titleLower.includes('sweep')) {
      try {
        await fetchBackend(`/api/drone/dispatch?zone=${encodeURIComponent(zone)}`, {
          method: 'POST'
        });
        addToast(`Autonomous Drone successfully dispatched to ${zone}`, 'success');
      } catch (err) {
        console.warn('Drone dispatch backend call failed:', err);
      }
    }
  };

  if (!isMounted || authLoading) {
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

  // if (!isAuthenticated) {
  //   return (
  //     <div className="min-h-[60vh] flex flex-col items-center justify-center text-center max-w-md mx-auto py-12">
  //       <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-safety-orange mb-4">
  //         <ShieldAlert className="w-6 h-6" />
  //       </div>
  //       <h3 className="font-heading text-lg font-bold text-white mb-2">Gatehouse Verification Required</h3>
  //       <p className="text-xs text-slate-400 leading-relaxed mb-6">
  //         You must log into the platform gateway to view refinery safety telemetry details.
  //       </p>
  //       <button
  //         onClick={() => router.push('/login')}
  //         className="bg-safety-orange text-white font-semibold text-xs px-6 py-2.5 rounded-xl hover:bg-safety-orange/90 transition-colors cursor-pointer"
  //       >
  //         Proceed to Login
  //       </button>
  //     </div>
  //   );
  // }
  if(!isAuthenticated){
    return null;
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
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs font-mono ${
            wsConnected ? 'text-slate-400' : 'text-amber-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-ping' : 'bg-amber-500'}`} />
            <span>{wsConnected ? 'LIVE TELEMETRY: CONNECTED' : 'OFFLINE — CACHED DATA'}</span>
          </div>
          <div className={`flex items-center gap-2 border rounded-xl px-3 py-1.5 text-xs font-mono font-semibold ${
            overallRisk === 'Low' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
            overallRisk === 'Medium' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
            overallRisk === 'High' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
            'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            <span>OVERALL RISK: {overallRisk.toUpperCase()}</span>
          </div>
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

      {/* Main Container */}
      <div className="flex flex-col gap-6">
          
          {/* Spatial Selector Panel */}
          <div className="glass-panel border border-white/10 rounded-3xl p-6 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="font-heading text-base font-bold text-white tracking-wide">Plant Telemetry Monitor</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Select plant segment to filter sensors</p>
                <div className="flex gap-3 mt-2 text-[10px] font-mono text-slate-400">
                  <span>GAS LEL: <span className="text-slate-200 font-semibold">{telemetry.gasLpgLEL}%</span></span>
                  <span>PRESSURE: <span className="text-slate-200 font-semibold">{telemetry.segmentDPressure} bar</span></span>
                  <span>TEMP: <span className="text-slate-200 font-semibold">{telemetry.temperature}°C</span></span>
                </div>
              </div>

              {/* Plant Switchers Removed (Plant A only) */}
              <div className="flex gap-2">
              </div>
            </div>

            {/* Plant Stats display */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-black/35 border border-white/5 rounded-2xl p-5">
              <div className="flex flex-col items-center justify-center p-3 text-center border-b sm:border-b-0 sm:border-r border-white/5">
                <RiskGauge score={plantStats[selectedPlant].safety} size={160} />
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

            {/* Active Work Permits for selected zone */}
            <div className="bg-black/35 border border-white/5 rounded-2xl p-5">
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-3">
                Active Work Permits — {plantStats[selectedPlant].name}
              </span>
              {(() => {
                const zonePermits = activePermits.filter((p: any) => p.zone === plantStats[selectedPlant].zone);
                if (zonePermits.length === 0) {
                  return (
                    <p className="text-xs text-slate-500 italic">No active permits in this segment.</p>
                  );
                }
                return (
                  <div className="flex flex-col gap-2">
                    {zonePermits.map((p: any, idx: number) => (
                      <div key={p.permitId || idx} className="flex justify-between items-center bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs">
                        <span className="text-slate-300">{p.description}</span>
                        <span className="text-[9px] font-mono text-safety-orange uppercase">{p.permitId}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

          </div>

          {/* AI Explainable Fusion Reasoning */}
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-safety-orange" />
                <h3 className="font-heading text-base font-bold text-white tracking-wide">
                  Agentic Risk Fusion Diagnosis
                </h3>
              </div>
              <button
                onClick={handleRunDebate}
                disabled={isDebating}
                className="px-3 py-1.5 bg-safety-orange/20 border border-safety-orange/30 text-safety-orange hover:bg-safety-orange hover:text-white rounded-xl text-[10px] font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>{isDebating ? 'DEBATING...' : 'AGENT DEBATE'}</span>
              </button>
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

      {/* Collaborative Safety Debate Modal */}
      <Modal isOpen={isDebateModalOpen} onClose={() => setIsDebateModalOpen(false)} title={`Collaborative Agentic Debate — ${debateResult?.zone}`}>
        <div className="flex flex-col gap-5 text-xs text-slate-300">
          
          {/* Top Summary Banner */}
          <div className="bg-black/35 border border-white/5 p-4 rounded-xl flex flex-col justify-between gap-4 border-l-4 border-l-safety-orange">
            <div>
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">CONSENSUS VERDICT:</span>
              <span className="text-xs font-mono text-safety-orange font-bold uppercase tracking-wider block mt-1">
                {debateResult?.prediction}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-white/5 pt-3">
              <div>
                <span className="text-[9px] text-slate-500 font-mono block">RISK INDEX</span>
                <span className={`text-2xl font-extrabold block mt-0.5 ${
                  (debateResult?.risk_probability || 0) >= 75 ? 'text-red-500' :
                  (debateResult?.risk_probability || 0) >= 40 ? 'text-safety-orange' :
                  'text-green-400'
                }`}>
                  {debateResult?.risk_probability}%
                </span>
              </div>
              {debateResult?.weather_info && (
                <div className="text-right">
                  <span className="text-[9px] text-slate-500 font-mono block">VENTILATION / WIND</span>
                  <span className="text-xs font-semibold text-slate-200 block mt-0.5">
                    {debateResult.weather_info.ventilation_status} ({debateResult.weather_info.wind_speed_m_s} m/s)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Compound Factors */}
          <div>
            <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider block mb-2">COMPOUND DANGER FACTORS</span>
            <div className="flex flex-wrap gap-2">
              {debateResult?.compound_factors?.map((f: any, idx: number) => (
                <span key={idx} className="bg-white/5 border border-white/5 rounded-lg px-2.5 py-1 text-slate-300 font-mono text-[10px]">
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Chat History */}
          <div>
            <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider block mb-3">COMMITTEE DISCUSSION FEED</span>
            <div className="flex flex-col gap-3 max-h-[30vh] overflow-y-auto pr-1">
              {debateResult?.debate_transcript?.map((msg: any, idx: number) => {
                const isCoordinator = msg.agent_id === 'coordinator_agent';
                const isCritical = msg.sentiment === 'critical';
                const isWarning = msg.sentiment === 'warning';
                
                let borderCol = 'border-white/5 bg-white/[0.01]';
                if (isCoordinator) borderCol = 'border-safety-orange/30 bg-safety-orange/10 border-l-4 border-l-safety-orange';
                else if (isCritical) borderCol = 'border-red-500/25 bg-red-500/5 border-l-4 border-l-red-500';
                else if (isWarning) borderCol = 'border-amber-500/25 bg-amber-500/5 border-l-4 border-l-amber-500';

                return (
                  <div key={idx} className={`p-3.5 rounded-xl border flex flex-col gap-1.5 ${borderCol}`}>
                    <div className="flex justify-between items-center text-[9px] font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white uppercase">{msg.agent_name}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400 font-medium italic">{msg.role}</span>
                      </div>
                      <span className="text-slate-500 font-bold">R{msg.round}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed font-sans mt-0.5">{msg.message}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommendations */}
          <div>
            <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider block mb-2">RESOLVING DIRECTIVES</span>
            <div className="flex flex-col gap-2">
              {debateResult?.recommendations?.map((r: any, idx: number) => (
                <div key={idx} className="bg-white/5 border border-white/5 p-3 rounded-lg flex items-center justify-between">
                  <span className="font-sans text-[11px] text-slate-300 font-medium">{r}</span>
                  <button
                    onClick={() => {
                      handleResolveAction(r);
                      setIsDebateModalOpen(false);
                    }}
                    className="text-[10px] text-safety-orange hover:underline font-semibold font-mono"
                  >
                    DISPATCH
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
}
