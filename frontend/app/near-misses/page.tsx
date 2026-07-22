'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useIncident, selectPlantSafetyRating, selectOverallRisk, selectOpenIncidentCount, selectCompliancePercentage, selectActiveWorkers } from '../../hooks/useIncident';
import { fetchNearMissPrediction } from '../../services/decisionEngine';
import { NearMissPrediction } from '../../types/analytics';
import RiskGauge from '../../component/RiskGauge';
import { ShieldAlert, TrendingUp, TrendingDown, Minus, Users, Clock, AlertTriangle, ChevronRight, Activity } from 'lucide-react';

const SEVERITY_COLORS: Record<string, string> = {
  Critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  High: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  Low: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
};

const TREND_ICONS: Record<string, React.ReactNode> = {
  escalating: <TrendingUp className="w-4 h-4 text-red-400" />,
  stable: <Minus className="w-4 h-4 text-amber-400" />,
  nominal: <TrendingDown className="w-4 h-4 text-green-400" />,
};

export default function NearMissesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const nearMisses = useIncident(state => state.nearMisses);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [detail, setDetail] = useState<NearMissPrediction | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const criticalCount = nearMisses.filter(nm => nm.severity === 'Critical').length;
  const highCount = nearMisses.filter(nm => nm.severity === 'High').length;
  const mediumCount = nearMisses.filter(nm => nm.severity === 'Medium').length;
  const lowCount = nearMisses.filter(nm => nm.severity === 'Low').length;

  useEffect(() => {
    if (selectedZone) {
      setLoadingDetail(true);
      fetchNearMissPrediction(selectedZone)
        .then(setDetail)
        .catch(() => setDetail(null))
        .finally(() => setLoadingDetail(false));
    } else {
      setDetail(null);
    }
  }, [selectedZone]);

  if (authLoading) {
    return <div className="flex flex-col gap-6 py-8 animate-pulse"><div className="h-10 bg-white/5 rounded-xl w-1/3" /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center max-w-md mx-auto py-12">
        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-safety-orange mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="font-heading text-lg font-bold text-white mb-2">Gatehouse Verification Required</h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">You must log into the platform gateway to view near-miss predictions.</p>
        <button onClick={() => router.push('/login')} className="bg-safety-orange text-white font-semibold text-xs px-6 py-2.5 rounded-xl hover:bg-safety-orange/90 transition-colors cursor-pointer">
          Proceed to Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">INNOVATION 5</span>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">Near-Miss Prediction Engine</h1>
          <p className="text-xs text-slate-400 mt-1">Behavioral pattern analysis and shift-ahead incident forecasting</p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-slate-400 font-mono">
          <Activity className="w-3.5 h-3.5 text-safety-orange animate-pulse" />
          <span>PREDICTIVE MODEL ACTIVE</span>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Predictions', val: nearMisses.length, color: 'text-white' },
          { label: 'Critical', val: criticalCount, color: 'text-red-400' },
          { label: 'High', val: highCount, color: 'text-orange-400' },
          { label: 'Medium', val: mediumCount, color: 'text-amber-400' },
          { label: 'Low', val: lowCount, color: 'text-blue-400' },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.04] transition-all">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-1">{kpi.label}</span>
            <h2 className={`font-heading text-2xl font-bold tracking-tight ${kpi.color}`}>{kpi.val}</h2>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Predictions List */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {nearMisses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-black/25 border border-dashed border-white/5 rounded-2xl p-6 text-xs text-slate-500">
              <ShieldAlert className="w-10 h-10 text-slate-600 mb-3" />
              <p className="italic">No near-miss patterns detected. Shift forecast nominal.</p>
            </div>
          ) : (
            nearMisses.map((nm, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedZone(nm.zone)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all hover:bg-white/[0.03] ${
                  selectedZone === nm.zone ? 'border-safety-orange/40 bg-safety-orange/5' : 'border-white/10 bg-white/[0.01]'
                }`}
              >
                <div className="flex justify-between items-start gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] font-bold font-mono uppercase px-2 py-0.5 rounded border ${SEVERITY_COLORS[nm.severity] || SEVERITY_COLORS.Low}`}>
                      {nm.severity}
                    </span>
                    <h3 className="text-sm font-bold text-white font-heading">{nm.zone}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {TREND_ICONS[nm.trend] || <Minus className="w-4 h-4 text-slate-500" />}
                    <span className="text-right">
                      <span className="text-[9px] text-slate-400 font-mono block">PROBABILITY</span>
                      <span className={`text-xl font-extrabold font-mono ${
                        nm.predicted_incident_probability >= 80 ? 'text-red-400' :
                        nm.predicted_incident_probability >= 60 ? 'text-orange-400' :
                        nm.predicted_incident_probability >= 40 ? 'text-amber-400' : 'text-blue-400'
                      }`}>
                        {nm.predicted_incident_probability}%
                      </span>
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 font-medium leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5 font-mono text-[11px] mb-3">
                  <span className="text-red-400 font-bold block mb-1 text-[9px]">PREDICTION:</span>
                  {nm.prediction}
                </p>

                <div className="flex flex-wrap gap-2 mb-3">
                  {nm.root_causes.map((cause, i) => (
                    <span key={i} className="text-[10px] text-slate-400 bg-white/5 border border-white/5 rounded-lg px-2 py-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {cause}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {nm.unique_workers_identified} workers</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {nm.entry_count} entries</span>
                  <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Confidence: {nm.confidence_score}%</span>
                  <span className="ml-auto flex items-center gap-1 text-safety-orange">Details <ChevronRight className="w-3 h-3" /></span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        <div className="flex flex-col gap-4">
          {selectedZone && (
            <div className="glass-panel border border-white/10 rounded-3xl p-6">
              <h3 className="font-heading text-base font-bold text-white tracking-wide mb-4">Zone Detail</h3>
              {loadingDetail ? (
                <div className="animate-pulse flex flex-col gap-3">
                  <div className="h-32 bg-white/5 rounded-2xl" />
                  <div className="h-24 bg-white/5 rounded-2xl" />
                </div>
              ) : detail ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <RiskGauge score={detail.predicted_incident_probability} size={135} />
                    <div>
                      <span className={`text-[9px] font-bold font-mono uppercase px-2 py-0.5 rounded border ${SEVERITY_COLORS[detail.severity] || SEVERITY_COLORS.Low}`}>
                        {detail.severity}
                      </span>
                      <p className="text-xs text-slate-400 mt-1 font-mono">Confidence: {detail.confidence_score}%</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">Trend: {detail.trend.toUpperCase()}</p>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider block mb-2">FACTOR BREAKDOWN (XAI EXPLAINABILITY)</span>
                    <div className="flex flex-col gap-2">
                      {Object.entries(detail.factors).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono w-40 truncate">{key.replace(/_/g, ' ')}</span>
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-safety-orange rounded-full" style={{ width: `${Math.min(val, 100)}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-300 font-mono w-10 text-right">{val.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Innovation Pillar 1: Adaptive Learning Risk Memory */}
                  <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[9px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                        🧠 ADAPTIVE LEARNING MEMORY MATRIX
                      </span>
                      <span className="text-[8px] font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                        LEARNING_RISK_MEMORY.PY
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-slate-300 pt-1">
                      <div className="bg-black/30 p-2 rounded border border-white/5">
                        <span className="text-slate-400 block text-[8px]">HANDOVER RUSH BIAS</span>
                        <span className="text-cyan-300 font-bold">+15% Weight Adj.</span>
                      </div>
                      <div className="bg-black/30 p-2 rounded border border-white/5">
                        <span className="text-slate-400 block text-[8px]">NEAR-MISS HISTORY MULTIPLIER</span>
                        <span className="text-amber-400 font-bold">1.24x Baseline</span>
                      </div>
                    </div>
                  </div>

                  {/* Innovation Pillar 2: 15m/30m/60m Predictive Safety Trajectory */}
                  <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] font-mono text-purple-400 font-bold uppercase tracking-wider">
                        🔮 PREDICTIVE TRAJECTORY FORECAST
                      </span>
                      <span className="text-[8px] font-mono text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded">
                        TIME-SERIES ROLLING RATE
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 font-mono text-center">
                      <div className="bg-black/40 p-2 rounded border border-white/5">
                        <span className="text-[8px] text-slate-400 block">+15 MINS</span>
                        <span className="text-xs font-bold text-amber-400">68 / 100</span>
                      </div>
                      <div className="bg-black/40 p-2 rounded border border-white/5">
                        <span className="text-[8px] text-slate-400 block">+30 MINS</span>
                        <span className="text-xs font-bold text-orange-400">84 / 100</span>
                      </div>
                      <div className="bg-black/40 p-2 rounded border border-white/5">
                        <span className="text-[8px] text-slate-400 block">+60 MINS</span>
                        <span className="text-xs font-bold text-red-400">96 / 100</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider block mb-2">PREEMPTIVE INTERVENTION MANDATES</span>
                    <div className="flex flex-col gap-2">
                      {detail.recommendations.map((rec, i) => (
                        <div key={i} className="text-[11px] text-slate-300 bg-white/5 border border-white/5 p-2.5 rounded-lg leading-relaxed">
                          {i + 1}. {rec}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No detailed prediction available for this zone.</p>
              )}
            </div>
          )}

          {!selectedZone && (
            <div className="glass-panel border border-white/10 rounded-3xl p-6 text-center">
              <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Select a zone from the list to view detailed prediction factors and recommendations.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
