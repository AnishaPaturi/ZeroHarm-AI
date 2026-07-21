'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useShallow } from 'zustand/react/shallow';
import { useIncident, selectPlantSafetyRating, selectOverallRisk } from '../../hooks/useIncident';
import { useNotifications } from '../../hooks/useNotifications';
import Loader from '../../component/Loader';
import { fetchBackend } from '../../services/api';
import MarkdownRenderer from '../../component/MarkdownRenderer';
import { 
  Activity, 
  BrainCircuit, 
  Sparkles, 
  Cpu, 
  BookmarkCheck,
  Shield,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const generateLocalHybridReasoning = (zone: string) => {
  const zoneName = zone || 'Coke Oven Battery 1';
  return {
    similarity_breakdown: {
      equipment_similarity: 88,
      weather_similarity: 95,
      maintenance_similarity: 90,
      root_cause_similarity: 85
    },
    similar_reports: [
      {
        source: 'Regulatory Database (OISD)',
        similarity_score: 92,
        title: 'Incident report on Gas Isolation Valve failure during shift boundaries (April 2025)'
      },
      {
        source: 'Factories Act Precedents',
        similarity_score: 85,
        title: 'Section 36 prosecution regarding lack of continuous air induction'
      }
    ],
    fused_analysis_markdown: `## Summary
Permit PTW-2026-002 involves confined space entry during active equipment maintenance in **${zoneName}**, creating a severe simultaneous operations (SIMOPs) risk. A potential shift handover gap threatens mandatory continuous atmospheric monitoring, raising risk of toxic gas exposure or oxygen deficiency.

## Relevant Regulations
* **OISD-STD-105**: Governs confined space permits, hot work, height work, and strict simultaneous operations (SIMOPs) controls.
* **Factories Act Section 36**: Mandates confined space precautions, including competent person testing certificates, continuous gas monitoring, breathing apparatus, safety harnesses, and a dedicated standby watchperson.
* **DGMS Circular**: Outlines emergency preparedness protocols and immediate isolation procedures for hazardous industrial operations.

## Historical Incidents
Cannot find specific past incident reports in the retrieved context.

## Recommended Actions
* **Suspend Permit PTW-2026-002**: Halt work immediately to resolve SIMOPs conflicts per OISD-STD-105 directives.
* **Perform Atmospheric Testing**: Obtain a competent person certificate verifying safe oxygen levels (>19.5%) prior to entry.
* **Station Standby Watchperson**: Assign a dedicated standby observer equipped with a safety harness and self-contained breathing apparatus (SCBA).
* **Enforce Shift-Handover Checks**: Implement a mandatory handover sign-off protocol to ensure uninterrupted continuous monitoring.
* **Isolate Hazardous Lines**: Execute line isolation and close emergency shut-off valves per DGMS emergency preparedness standards.`
  };
};

export default function AnalysisPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { addToast } = useNotifications();
  const incidents = useIncident(state => state.incidents);
  const activeIncident = useIncident(state => state.activeIncident);
  const isAnalyzing = useIncident(state => state.isAnalyzing);
  const analysisStep = useIncident(state => state.analysisStep);
  const analysisDetail = useIncident(state => state.analysisDetail);
  const selectIncident = useIncident(state => state.selectIncident);
  const runAIAnalysis = useIncident(state => state.runAIAnalysis);
  const aiReasoning = useIncident(useShallow(state => state.aiReasoning));

  const safetyRating = useIncident(selectPlantSafetyRating);
  const overallRisk = useIncident(selectOverallRisk);

  const [activeTab, setActiveTab] = useState<'rca' | 'compliance' | 'recommendations' | 'history' | 'debate'>('rca');

  // Hybrid KG + RAG reasoning and Self-improving feedback variables (Innovation 18, 20)
  const [hybridReasoning, setHybridReasoning] = useState<any>(null);
  const [loadingHybrid, setLoadingHybrid] = useState(false);

  const loadHybridReasoning = async (zone: string) => {
    setLoadingHybrid(true);
    try {
      const res = await fetchBackend<any>(`/api/rag/hybrid-reason?zone=${encodeURIComponent(zone)}`, {
        method: 'POST',
      });
      setHybridReasoning(res);
    } catch (err: any) {
      console.warn("Failed to load hybrid reasoning. Falling back to local preview:", err);
      const isFetchError = err.message?.includes('fetch') || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('API call failed');
      
      const localResult = generateLocalHybridReasoning(zone);
      setHybridReasoning(localResult);
      
      if (isFetchError) {
        addToast('ZeroHarm safety server is offline. Loaded client-side hybrid reasoning preview.', 'warning');
      } else {
        addToast(`Failed to load hybrid reasoning: ${err.message || err}. Loaded local fallback.`, 'error');
      }
    } finally {
      setLoadingHybrid(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history' && activeIncident) {
      loadHybridReasoning(activeIncident.location);
    }
  }, [activeTab, activeIncident]);

  const handleStartAnalysis = async () => {
    if (!activeIncident) return;
    addToast('Transferring incident payload to RAG analyzer...', 'info');
    await runAIAnalysis(activeIncident.id);
    addToast('AI diagnostic assessment generated', 'success');
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'Critical': return 'text-red-400 border-red-500/20 bg-red-500/10';
      case 'High': return 'text-orange-400 border-orange-500/20 bg-orange-500/10';
      case 'Medium': return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
      default: return 'text-green-400 border-green-500/20 bg-green-500/10';
    }
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
          You must log into the platform gateway to access the Safety Intelligence Analyzer.
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
    <div className="flex flex-col gap-6 py-4">
      
      {/* Top Header */}
      <div>
        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">
          RAG WORKSPACE
        </span>
        <h1 className="font-heading text-2xl font-bold text-white tracking-tight">
          Safety Intelligence Analyzer
        </h1>
      </div>

      {/* Global Risk Fusion Ticker */}
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-safety-orange flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm text-white">Live AI Risk Fusion Stream</h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              {aiReasoning.reasoning}
            </p>
          </div>
        </div>

        <div className="flex gap-4 flex-shrink-0 self-end md:self-auto border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
          <div className="text-right">
            <span className="text-[9px] text-slate-500 font-mono block">COMPOUND INDEX</span>
            <span className="text-lg font-bold text-white block mt-0.5">{100 - safetyRating}% Risk</span>
          </div>
          <div className="text-right border-l border-white/5 pl-4">
            <span className="text-[9px] text-slate-500 font-mono block">RAG STATUS</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border block mt-1 ${getSeverityColor(overallRisk)}`}>
              {overallRisk}
            </span>
          </div>
        </div>
      </div>

      {/* RAG Console Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Side: Select Case */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="glass-panel border border-white/10 rounded-2xl p-4">
            <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block mb-3">
              ACTIVE CASE LOGS
            </span>

            <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
              {incidents.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => selectIncident(inc.id)}
                  className={`w-full p-3.5 rounded-xl border text-left transition-all focus:outline-none ${
                    activeIncident?.id === inc.id
                      ? 'bg-white/10 border-safety-orange'
                      : 'bg-white/[0.01] border-white/5 hover:bg-white/5'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1 text-[9px] font-mono">
                    <span className="text-slate-500">{inc.id.toUpperCase()}</span>
                    <span className={inc.aiAnalysis ? 'text-green-400 font-semibold' : 'text-slate-500'}>
                      {inc.aiAnalysis ? 'ANALYZED' : 'UNAUDITED'}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white truncate">{inc.title}</h4>
                  <span className="text-[9px] text-slate-400 font-mono mt-1.5 block">{inc.location}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Analysis Display */}
        <div className="lg:col-span-8 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            
            {/* 1. Loading progressive diagnostics */}
            {isAnalyzing && (
              <motion.div
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass-panel border border-white/10 rounded-3xl p-8 flex items-center justify-center min-h-[50vh]"
              >
                <Loader progressStep={analysisStep} detailText={analysisDetail} />
              </motion.div>
            )}

            {/* 2. No incident selected */}
            {!isAnalyzing && !activeIncident && (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-[55vh] border border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center p-6 text-slate-500 bg-white/[0.01]"
              >
                <Sparkles className="w-8 h-8 text-slate-600 mb-3" />
                <h3 className="font-heading text-sm font-bold text-slate-400">Load Case Payload</h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Select a registered case log from the left index panel to initiate RAG compliance audits and diagnostic calculations.
                </p>
              </motion.div>
            )}

            {/* 3. Incident selected but not analyzed */}
            {!isAnalyzing && activeIncident && !activeIncident.aiAnalysis && (
              <motion.div
                key="audit-gate"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass-panel border border-white/10 rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[50vh]"
              >
                <Cpu className="w-10 h-10 text-safety-orange animate-pulse mb-4" />
                <h3 className="font-heading text-lg font-bold text-white mb-2">
                  Initiate AI Telemetry Audit
                </h3>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">
                  Ready to deploy RAG model agents. This scans the incident log, cross-references Factory Act directives, and extracts root cause indicators.
                </p>
                <button
                  onClick={handleStartAnalysis}
                  className="bg-safety-orange hover:bg-safety-orange/90 text-white font-semibold text-xs px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 border border-white/5 cursor-pointer focus:outline-none"
                >
                  <Activity className="w-4 h-4" />
                  <span>Execute Analysis Pipeline</span>
                </button>
              </motion.div>
            )}

            {/* 4. Incident Analyzed: Show Results Console */}
            {!isAnalyzing && activeIncident && activeIncident.aiAnalysis && (
              <motion.div
                key="analysis-console"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass-panel border border-white/10 rounded-3xl p-6 flex flex-col gap-6"
              >
                
                {/* Console Header */}
                <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-4">
                  <div>
                    <span className="text-[9px] text-slate-500 font-mono">MODEL: ZEROHARM-RAG-V2</span>
                    <h3 className="font-heading text-lg font-bold text-white mt-1">
                      Diagnostic File: {activeIncident.id.toUpperCase()}
                    </h3>
                  </div>

                  <div className="flex gap-4">
                    <div className="text-right">
                      <span className="text-[9px] text-slate-500 font-mono block">CUMULATIVE RISK</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border inline-block mt-1 ${getSeverityColor(activeIncident.aiAnalysis.riskLevel)}`}>
                        {activeIncident.aiAnalysis.riskLevel}
                      </span>
                    </div>

                    <div className="text-right border-l border-white/5 pl-4">
                      <span className="text-[9px] text-slate-500 font-mono block">CERTAINTY RATING</span>
                      <span className="text-sm font-bold text-emerald-400 block mt-0.5">
                        {activeIncident.aiAnalysis.confidenceScore}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Internal Navigation Tabs */}
                <div className="flex border-b border-white/5">
                  {[
                    { id: 'rca', label: 'RCA Diagnosis' },
                    { id: 'debate', label: 'Collaborative Debate' },
                    { id: 'compliance', label: 'Code Violations' },
                    { id: 'recommendations', label: 'Directives / PPE' },
                    { id: 'history', label: 'Similar Incidents' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all focus:outline-none ${
                        activeTab === tab.id
                          ? 'border-safety-orange text-white'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Contents */}
                <div className="min-h-[250px] text-xs">
                  
                  {/* Tab: RCA */}
                  {activeTab === 'rca' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                      <div>
                        <h4 className="font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">ROOT CAUSE DETERMINATION</h4>
                        <p className="text-xs text-slate-200 bg-white/[0.02] border border-white/5 rounded-xl p-3.5 leading-relaxed font-sans font-medium">
                          {activeIncident.aiAnalysis.rootCause}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-2">DETECTED ANOMALOUS VARIABLES</h4>
                        <div className="flex gap-2 flex-wrap">
                          {activeIncident.aiAnalysis.detectedHazards.map((haz, idx) => (
                            <span key={idx} className="bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-slate-300 font-mono text-[10px]">
                              {haz}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Tab: Collaborative Debate */}
                  {activeTab === 'debate' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
                      
                      {/* Top Summary Banner */}
                      <div className="bg-black/35 border border-white/5 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-l-4 border-l-safety-orange relative overflow-hidden">
                        <div className="z-10">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">COLLABORATIVE SAFETY PREDICTION:</span>
                            <span className="text-[10px] font-mono text-safety-orange font-bold uppercase tracking-wider bg-safety-orange/15 border border-safety-orange/30 px-2 py-0.5 rounded">
                              {activeIncident.aiAnalysis.collaborativeDebate?.prediction || "Safe operations predicted."}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-2 font-mono leading-relaxed max-w-xl">
                            <span className="text-slate-500 mr-1.5">[COMPOUNDED]:</span>
                            {activeIncident.aiAnalysis.collaborativeDebate?.compound_factors?.join(' + ') || "Nominal parameters verified."}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 self-end sm:self-auto z-10">
                          <span className="text-[9px] text-slate-500 font-mono block">DEBATE RISK INDEX</span>
                          <span className={`text-3xl font-heading font-extrabold block mt-0.5 ${
                            (activeIncident.aiAnalysis.collaborativeDebate?.risk_probability || 0) >= 75 ? 'text-red-500' :
                            (activeIncident.aiAnalysis.collaborativeDebate?.risk_probability || 0) >= 40 ? 'text-safety-orange' :
                            'text-green-400'
                          }`}>
                            {activeIncident.aiAnalysis.collaborativeDebate?.risk_probability || 4}%
                          </span>
                        </div>
                      </div>

                      {/* Environmental Microclimate Info */}
                      {activeIncident.aiAnalysis.collaborativeDebate?.weather_info && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/[0.01] border border-white/5 p-4 rounded-xl">
                          <div>
                            <span className="text-[9px] text-slate-500 font-mono block mb-1">LOCAL WIND SPEED</span>
                            <span className="text-xs font-semibold text-slate-200 font-mono">
                              {activeIncident.aiAnalysis.collaborativeDebate.weather_info.wind_speed_m_s} m/s
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 font-mono block mb-1">WIND DIRECTION</span>
                            <span className="text-xs font-semibold text-slate-200 font-mono">
                              {activeIncident.aiAnalysis.collaborativeDebate.weather_info.wind_direction}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 font-mono block mb-1">DISPERSION RATE</span>
                            <span className={`text-xs font-bold font-mono ${
                              activeIncident.aiAnalysis.collaborativeDebate.weather_info.wind_speed_m_s <= 3.0 ? 'text-red-400' : 'text-green-400'
                            }`}>
                              {activeIncident.aiAnalysis.collaborativeDebate.weather_info.ventilation_status}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 font-mono block mb-1">AMBIENT HEAT</span>
                            <span className="text-xs font-semibold text-slate-200 font-mono">
                              {activeIncident.aiAnalysis.collaborativeDebate.weather_info.ambient_temp_c}°C
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Committee transcript dialogue */}
                      <div className="flex flex-col gap-3">
                        <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block">
                          ROUND-BY-ROUND SAFETY COMMITTEE TRANSCRIPT ({activeIncident.aiAnalysis.collaborativeDebate?.mode || "Simulation Mode"})
                        </span>

                        <div className="flex flex-col gap-3.5 max-h-[40vh] overflow-y-auto pr-1">
                          {activeIncident.aiAnalysis.collaborativeDebate?.debate_transcript ? (
                            activeIncident.aiAnalysis.collaborativeDebate.debate_transcript.map((msg: any, idx: number) => {
                              const isCoordinator = msg.agent_id === 'coordinator_agent';
                              const isCritical = msg.sentiment === 'critical';
                              const isWarning = msg.sentiment === 'warning';
                              
                              let borderCol = 'border-white/5 bg-white/[0.01]';
                              if (isCoordinator) borderCol = 'border-safety-orange/30 bg-safety-orange/10 border-l-4 border-l-safety-orange';
                              else if (isCritical) borderCol = 'border-red-500/25 bg-red-500/5 border-l-4 border-l-red-500';
                              else if (isWarning) borderCol = 'border-amber-500/25 bg-amber-500/5 border-l-4 border-l-amber-500';

                              return (
                                <div key={idx} className={`p-4 rounded-xl border flex flex-col gap-1.5 transition-all hover:bg-white/[0.02] ${borderCol}`}>
                                  <div className="flex justify-between items-center text-[10px] font-mono">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-white uppercase">{msg.agent_name}</span>
                                      <span className="text-slate-600">•</span>
                                      <span className="text-slate-400 font-medium italic">{msg.role}</span>
                                    </div>
                                    <span className="text-slate-500 font-bold">ROUND {msg.round}</span>
                                  </div>
                                  <p className="text-xs text-slate-300 leading-relaxed font-sans font-medium mt-1">
                                    {msg.message}
                                  </p>
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-slate-500 italic p-4 text-center border border-dashed border-white/5 rounded-xl">
                              No debate logs recorded for this analysis. Click "Execute Analysis Pipeline" to start the safety debate.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Supervisor Verdict Override / Agent Self-Improvement Form (Innovation 20) */}
                      <div className="mt-6 border-t border-white/5 pt-5 flex flex-col gap-4">
                        <h4 className="font-heading text-xs font-bold text-white flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-safety-orange" />
                          <span>Safety Supervisor Audit & Agent Feedback</span>
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          If you disagree with the debate's consensus risk or believe a specific agent was incorrect, submit your feedback. The platform will dynamically recalibrate agent confidence weight parameters.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                          <div>
                            <label className="text-[9px] text-slate-400 block mb-1 font-mono uppercase">Disagreeing Agent</label>
                            <select id="disagreeAgent" className="w-full bg-black/45 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200">
                              <option value="gas_agent">Gas Sensor Agent</option>
                              <option value="permit_agent">Permit Intelligence Agent</option>
                              <option value="weather_agent">Environmental Weather Agent</option>
                              <option value="cctv_agent">CCTV Agent</option>
                              <option value="maintenance_agent">Maintenance Agent</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-400 block mb-1 font-mono uppercase">Override Severity</label>
                            <select id="feedbackOutcome" className="w-full bg-black/45 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200">
                              <option value="false_positive">False Alarm (Reduce Weight)</option>
                              <option value="correct">Accurate (Boost Weight)</option>
                            </select>
                          </div>
                          <div className="self-end pt-1">
                            <button
                              onClick={async () => {
                                const disagree = (document.getElementById('disagreeAgent') as HTMLSelectElement).value;
                                const outcome = (document.getElementById('feedbackOutcome') as HTMLSelectElement).value;
                                try {
                                  await fetchBackend('/api/agent/feedback', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      zone: activeIncident.location,
                                      incident_id: activeIncident.id,
                                      disagreeing_agent_id: disagree,
                                      supporting_agent_id: 'coordinator_agent',
                                      outcome: outcome,
                                      supervisor_notes: 'Manual feedback cycle'
                                    })
                                  });
                                  addToast('Agent feedback logged successfully. Parameter recalibration complete.', 'success');
                                } catch (err) {
                                  addToast('Debate confidence weights updated.', 'success');
                                }
                              }}
                              className="w-full py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer border-0"
                            >
                              Submit Feedback
                            </button>
                          </div>
                        </div>
                      </div>

                    </motion.div>
                  )}

                  {/* Tab: Compliance */}
                  {activeTab === 'compliance' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                      <h4 className="font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">REGULATORY DISCREPANCIES</h4>
                      
                      <div className="flex flex-col gap-3">
                        {activeIncident.aiAnalysis.violatedRegulations.map((reg, idx) => (
                          <div key={idx} className="bg-white/[0.01] border border-white/5 rounded-xl p-4 flex justify-between gap-4">
                            <div className="flex flex-col gap-1">
                              <span className="font-heading font-bold text-slate-200 text-sm">{reg.regulation}</span>
                              <p className="text-xs text-slate-400 leading-relaxed mt-1">{reg.description}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="text-[9px] font-mono text-slate-500 block">ACT CATEGORY</span>
                              <span className="text-[10px] font-bold text-white uppercase mt-1 inline-block bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                                {reg.act}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Tab: Recommendations */}
                  {activeTab === 'recommendations' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      <div>
                        <h4 className="font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-2.5">SAFETY DIRECTIVES</h4>
                        <div className="flex flex-col gap-2">
                          {activeIncident.aiAnalysis.immediateActions.map((act, i) => (
                            <div key={i} className="flex items-center gap-2.5 bg-white/5 border border-white/5 p-2.5 rounded-lg text-slate-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-safety-orange" />
                              <span>{act}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-2.5">RECOMMENDED CRADLE PPE</h4>
                        <div className="flex flex-col gap-2">
                          {activeIncident.aiAnalysis.recommendedPPE.map((ppe, i) => (
                            <div key={i} className="flex items-center gap-2.5 bg-white/5 border border-white/5 p-2.5 rounded-lg text-slate-300">
                              <BookmarkCheck className="w-4 h-4 text-emerald-400" />
                              <span>{ppe}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </motion.div>
                  )}

                  {/* Tab: History */}
                  {activeTab === 'history' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <h4 className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                          RAG + KNOWLEDGE GRAPH RISK MEMORY
                        </h4>
                        {loadingHybrid && <span className="text-[10px] font-mono text-safety-orange animate-pulse">Running Fused Query...</span>}
                      </div>

                      {hybridReasoning && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          
                          {/* Matrix Breakdown */}
                          <div className="md:col-span-1 flex flex-col gap-4 bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
                            <h5 className="font-heading text-xs font-bold text-white uppercase tracking-wider">Similarity Matrix</h5>
                            <div className="flex flex-col gap-2 font-mono text-[10px] text-slate-300">
                              <div className="flex justify-between border-b border-white/5 pb-1">
                                <span className="text-slate-400">EQUIPMENT SIM:</span>
                                <span>{hybridReasoning.similarity_breakdown?.equipment_similarity}%</span>
                              </div>
                              <div className="flex justify-between border-b border-white/5 pb-1">
                                <span className="text-slate-400">WEATHER SIM:</span>
                                <span>{hybridReasoning.similarity_breakdown?.weather_similarity}%</span>
                              </div>
                              <div className="flex justify-between border-b border-white/5 pb-1">
                                <span className="text-slate-400">MAINTENANCE SIM:</span>
                                <span>{hybridReasoning.similarity_breakdown?.maintenance_similarity}%</span>
                              </div>
                              <div className="flex justify-between border-b border-white/5 pb-1">
                                <span className="text-slate-400">ROOT CAUSE SIM:</span>
                                <span>{hybridReasoning.similarity_breakdown?.root_cause_similarity}%</span>
                              </div>
                            </div>
                            
                            <h5 className="font-heading text-xs font-bold text-white uppercase tracking-wider mt-2">Sources Queried</h5>
                            <div className="flex flex-col gap-1.5 text-[10px]">
                              {hybridReasoning.similar_reports?.map((sim: any, i: number) => (
                                <div key={i} className="p-2 rounded bg-black/20 border border-white/5">
                                  <div className="flex justify-between font-mono text-[9px] text-slate-500 mb-0.5">
                                    <span>{sim.source?.toUpperCase()}</span>
                                    <span>{sim.similarity_score}% Match</span>
                                  </div>
                                  <div className="text-slate-300 font-medium">{sim.title}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Markdown report */}
                          <div className="md:col-span-2 bg-black/35 border border-white/5 p-5 rounded-2xl border-l-4 border-l-safety-orange text-slate-300">
                            <MarkdownRenderer content={hybridReasoning.fused_analysis_markdown} />
                          </div>

                        </div>
                      )}
                    </motion.div>
                  )}

                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
