'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useIncident } from '../../hooks/useIncident';
import RiskGauge from '../../component/RiskGauge';
import { ShieldAlert, TrendingUp, TrendingDown, Minus, AlertTriangle, User, Clock, MapPin, ShieldCheck } from 'lucide-react';

const SCORE_COLORS: Record<string, string> = {
  Critical: 'text-red-400',
  High: 'text-orange-400',
  Medium: 'text-amber-400',
  Low: 'text-green-400',
};

const TREND_ICONS: Record<string, React.ReactNode> = {
  escalating: <TrendingUp className="w-4 h-4 text-red-400" />,
  improving: <TrendingDown className="w-4 h-4 text-green-400" />,
  stable: <Minus className="w-4 h-4 text-amber-400" />,
};

export default function SafetyCoachPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const profiles = useIncident(state => state.workerSafetyProfiles);

  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const detail = selectedWorker ? profiles.find(p => p.worker_id === selectedWorker) : null;

  const atRiskCount = profiles.filter(p => p.safety_score < 70).length;
  const criticalCount = profiles.filter(p => p.safety_score < 50).length;
  const avgScore = profiles.length > 0 ? Math.round(profiles.reduce((a, b) => a + b.safety_score, 0) / profiles.length) : 0;

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
        <p className="text-xs text-slate-400 leading-relaxed mb-6">You must log into the platform gateway to view worker safety profiles.</p>
        <button onClick={() => router.push('/login')} className="bg-safety-orange text-white font-semibold text-xs px-6 py-2.5 rounded-xl hover:bg-safety-orange/90 transition-colors cursor-pointer">
          Proceed to Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">INNOVATION 6</span>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">AI Safety Coach</h1>
          <p className="text-xs text-slate-400 mt-1">Personalized safety scoring and coaching recommendations per worker</p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-slate-400 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-safety-orange" />
          <span>{profiles.length} PROFILES TRACKED</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Avg Safety Score', val: `${avgScore}/100`, color: avgScore >= 80 ? 'text-green-400' : avgScore >= 60 ? 'text-amber-400' : 'text-red-400' },
          { label: 'Workers Tracked', val: profiles.length, color: 'text-white' },
          { label: 'At Risk (<70)', val: atRiskCount, color: 'text-orange-400' },
          { label: 'Critical (<50)', val: criticalCount, color: 'text-red-400' },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.04] transition-all">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-1">{kpi.label}</span>
            <h2 className={`font-heading text-2xl font-bold tracking-tight ${kpi.color}`}>{kpi.val}</h2>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 flex flex-col gap-4">
          {profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-black/25 border border-dashed border-white/5 rounded-2xl p-6 text-xs text-slate-500">
              <ShieldAlert className="w-10 h-10 text-slate-600 mb-3" />
              <p className="italic">No worker profiles available yet. Events will populate profiles automatically.</p>
            </div>
          ) : (
            profiles.map((profile) => {
              const scoreColor = profile.safety_score >= 80 ? 'text-green-400' :
                profile.safety_score >= 60 ? 'text-amber-400' :
                profile.safety_score >= 40 ? 'text-orange-400' : 'text-red-400';
              const borderColor = profile.safety_score < 50 ? 'border-red-500/20 bg-red-500/5' :
                profile.safety_score < 70 ? 'border-orange-500/20 bg-orange-500/5' :
                'border-white/10 bg-white/[0.01]';

              return (
                <div
                  key={profile.worker_id}
                  onClick={() => setSelectedWorker(profile.worker_id)}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all hover:bg-white/[0.03] ${borderColor}`}
                >
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white font-heading">{profile.name}</h3>
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {profile.zone}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 font-mono block">SAFETY SCORE</span>
                      <span className={`text-xl font-extrabold font-mono ${scoreColor}`}>{profile.safety_score}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="text-[10px] text-slate-400 bg-white/5 border border-white/5 rounded px-2 py-0.5 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> PPE: {profile.ppe_violations}
                    </span>
                    <span className="text-[10px] text-slate-400 bg-white/5 border border-white/5 rounded px-2 py-0.5 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Zone: {profile.zone_violations}
                    </span>
                    <span className="text-[10px] text-slate-400 bg-white/5 border border-white/5 rounded px-2 py-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Fatigue: {profile.fatigue_score.toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-slate-400 bg-white/5 border border-white/5 rounded px-2 py-0.5 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> {profile.trend.toUpperCase()}
                    </span>
                  </div>

                  <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                    <span className="text-safety-orange font-bold font-mono text-[9px] block uppercase mb-1">Top Recommendation:</span>
                    <p className="text-slate-300 leading-relaxed text-[11px]">
                      {profile.recommendations.length > 0 ? profile.recommendations[0] : 'Maintain standard safety protocols.'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-col gap-4">
          {detail ? (
            <div className="glass-panel border border-white/10 rounded-3xl p-6">
              <h3 className="font-heading text-base font-bold text-white tracking-wide mb-4">Worker Detail</h3>
              <div className="flex items-center gap-4 mb-6">
                <RiskGauge score={detail.safety_score} size={120} />
                <div>
                  <span className={`text-[9px] font-bold font-mono uppercase px-2 py-0.5 rounded border ${
                    detail.safety_score >= 80 ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                    detail.safety_score >= 60 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                    'text-red-400 bg-red-500/10 border-red-500/20'
                  }`}>
                    {detail.safety_score >= 80 ? 'Good' : detail.safety_score >= 60 ? 'Caution' : 'At Risk'}
                  </span>
                  <p className="text-xs text-slate-400 mt-1 font-mono">Trend: {detail.trend.toUpperCase()}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Confidence: High</p>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider block mb-2">SAFETY FACTORS</span>
                <div className="flex flex-col gap-2">
                  {[
                    { label: 'PPE Violations', val: detail.ppe_violations, max: 10 },
                    { label: 'Zone Violations', val: detail.zone_violations, max: 10 },
                    { label: 'Ignored Alerts', val: detail.ignored_alerts, max: 10 },
                    { label: 'Fatigue Score', val: detail.fatigue_score, max: 100 },
                    { label: 'Risk Exposure', val: detail.risk_exposure_score, max: 100 },
                  ].map((factor) => (
                    <div key={factor.label} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono w-32 truncate">{factor.label}</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${factor.val > factor.max * 0.6 ? 'bg-red-400' : factor.val > factor.max * 0.3 ? 'bg-amber-400' : 'bg-green-400'}`}
                          style={{ width: `${Math.min((factor.val / factor.max) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-300 font-mono w-10 text-right">{factor.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider block mb-2">COACHING RECOMMENDATIONS</span>
                <div className="flex flex-col gap-2">
                  {detail.recommendations.map((rec, i) => (
                    <div key={i} className="text-[11px] text-slate-300 bg-white/5 border border-white/5 p-2.5 rounded-lg leading-relaxed">
                      {i + 1}. {rec}
                    </div>
                  ))}
                  {detail.recommendations.length === 0 && (
                    <p className="text-[11px] text-slate-500 italic">No recommendations at this time. Keep up the good work.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel border border-white/10 rounded-3xl p-6 text-center">
              <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Select a worker from the list to view their personalized safety profile and coaching plan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
