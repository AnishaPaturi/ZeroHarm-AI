'use client';

import React, { useEffect, useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useShallow } from 'zustand/react/shallow';
import { 
  useIncident,
  selectPlantSafetyRating,
  selectOpenIncidentCount,
  selectActiveWorkers,
  selectMonthlyIncidentData,
  selectDepartmentStats,
  selectSeverityStats,
  selectIncidentFreeDays
} from '../../hooks/useIncident';
import { BarChart3, TrendingUp, ShieldAlert, Award } from 'lucide-react';

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);

  const incidents = useIncident(state => state.incidents);
  const telemetry = useIncident(state => state.telemetry);
  const activePermits = useIncident(state => state.activePermits);
  const safetyRating = useIncident(selectPlantSafetyRating);
  const openIncidentCount = useIncident(selectOpenIncidentCount);
  const activeWorkersCount = useIncident(selectActiveWorkers);

  const monthlyData = useIncident(useShallow(selectMonthlyIncidentData));
  const departmentStats = useIncident(useShallow(selectDepartmentStats));
  const severityPieData = useIncident(useShallow(selectSeverityStats));
  const incidentFreeDays = useIncident(useShallow(selectIncidentFreeDays));

  useEffect(() => {
    setMounted(true);
  }, []);

  const SEVERITY_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444']; // green, yellow, orange, red

  if (!mounted) {
    return (
      <div className="flex flex-col gap-6 py-8 animate-pulse">
        <div className="h-10 bg-white/5 rounded-xl w-1/3" />
        <div className="h-80 bg-white/5 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-4">
      
      {/* Header */}
      <div>
        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">
          METRICS & REPORTS
        </span>
        <h1 className="font-heading text-2xl font-bold text-white tracking-tight">
          Safety Data Storytelling
        </h1>
      </div>

      {/* Grid of narrative stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Longest Incident-Free Cycle', val: incidentFreeDays.val, sub: incidentFreeDays.sub, icon: Award, color: 'text-emerald-400' },
          { label: 'Cumulative MTTR', val: `${(1.2 + (openIncidentCount * 0.4)).toFixed(1)} Hours`, sub: 'Mean Time To Resolution', icon: TrendingUp, color: 'text-blue-400' },
          { label: 'Active Permitted Risks', val: `${activePermits.length} Active`, sub: 'Permit system logs', icon: ShieldAlert, color: 'text-safety-orange' }
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:bg-white/[0.04] transition-all">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">{stat.label}</span>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <h3 className="font-heading text-xl font-bold text-white tracking-tight">
                {stat.val}
              </h3>
              <span className="text-[10px] text-slate-400 mt-1 block">{stat.sub}</span>
            </div>
          );
        })}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Monthly Incident area graph */}
        <div className="lg:col-span-8 glass-panel border border-white/10 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-heading text-base font-bold text-white tracking-wide">Incident Frequency & Severity</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Year-to-date monthly safety logs comparison</p>
          </div>

          <div className="h-64 mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#475569" fontSize={10} fontStyle="italic" />
                <YAxis stroke="#475569" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                  labelStyle={{ color: '#fff', fontSize: '10px', fontFamily: 'monospace' }}
                  itemStyle={{ fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="incidents" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorIncidents)" name="Total Inquiries" />
                <Area type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorCritical)" name="Critical Breaches" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity Pie Chart */}
        <div className="lg:col-span-4 glass-panel border border-white/10 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-heading text-base font-bold text-white tracking-wide">Severity Distribution</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Ratio of classified risk levels</p>
          </div>

          <div className="h-48 mt-4 relative flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {severityPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[index % SEVERITY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '10px', color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-2 mt-4 text-[10px] font-mono">
            {severityPieData.map((d, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SEVERITY_COLORS[i] }} />
                  <span className="text-slate-300">{d.name}</span>
                </div>
                <span className="font-bold text-white">{d.value} Cases</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Secondary Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Department loads */}
        <div className="lg:col-span-7 bg-white/[0.02] border border-white/5 rounded-3xl p-6">
          <div>
            <h3 className="font-heading text-base font-bold text-white tracking-wide">Department Load Factor</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Active logs vs resolution status per team</p>
          </div>

          <div className="h-64 mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentStats} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="department" stroke="#475569" fontSize={9} />
                <YAxis stroke="#475569" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                  labelStyle={{ color: '#fff', fontSize: '10px' }}
                  itemStyle={{ fontSize: '11px' }}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', fontStyle: 'italic' }} />
                <Bar dataKey="incidents" fill="#2563eb" radius={[4, 4, 0, 0]} name="Logged Inquiries" />
                <Bar dataKey="resolved" fill="#10b981" radius={[4, 4, 0, 0]} name="Resolved Cases" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Narrative explanation card */}
        <div className="lg:col-span-5 bg-white/[0.02] border border-white/5 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h4 className="font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-2 block">
              OPERATIONAL REPORT
            </h4>
            <h3 className="font-heading text-base font-bold text-white mb-2">
              Mid-Year Safety Evaluation
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Dynamic incident logs and active alerts are evaluated by our AI Risk Fusion Agent continuously. 
            </p>
            <p className="text-xs text-slate-400 leading-relaxed mt-4">
              Current telemetry LEL reads {telemetry.gasLpgLEL}%. Pipeline pressure segments are operating at {telemetry.segmentDPressure} bar.
            </p>
          </div>

          <div className="border-t border-white/5 pt-4 mt-6 flex justify-between items-center text-xs">
            <span className="text-slate-400 font-mono text-[10px]">CURRENT SAFETY INDEX:</span>
            <span className={`font-bold px-2 py-0.5 rounded ${safetyRating >= 90 ? 'text-green-400 bg-green-500/10 border border-green-500/20' : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'}`}>
              {safetyRating}% Score
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
