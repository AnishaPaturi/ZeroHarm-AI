'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import RiskGauge from '../../component/RiskGauge';
import { 
  useIncident,
  selectPlantSafetyRating,
  selectOverallRisk,
  selectOpenIncidentCount,
  selectCompliancePercentage,
  selectActiveWorkers,
  selectPlantAStats
} from '../../hooks/useIncident';
import { 
  Users, 
  FileWarning, 
  BookCheck, 
  Wrench, 
  ShieldAlert,
  Scan,
  FileText,
  BrainCircuit,
  MessageSquare,
  BarChart3,
  BookOpen,
  ArrowUpRight
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
  const activePermits = useIncident(state => state.activePermits);
  const emergencyMode = useIncident(state => state.emergencyMode);
  const evacuationMessage = useIncident(state => state.evacuationMessage);
  const wsConnected = useIncident(state => state.wsConnected);

  // computed derived selectors
  const safetyRating = useIncident(selectPlantSafetyRating);
  const overallRisk = useIncident(selectOverallRisk);
  const openIncidentCount = useIncident(selectOpenIncidentCount);
  const compliancePercentage = useIncident(selectCompliancePercentage);
  const activeWorkersCount = useIncident(selectActiveWorkers);

  const [selectedPlant, setSelectedPlant] = useState<'A'>('A');
  const plantAStats = useIncident(selectPlantAStats);

  const plantStats = {
    A: plantAStats
  };

  // Feature destinations — mirrors the navbar's own nav items, since Operations
  // now uses this card grid as its primary navigation instead of the top nav bar.
  const FEATURE_CARDS = [
    {
      title: 'Digital Twin',
      description: 'Live 2D plant visualization with real-time hazard zones, gas dispersion clouds, and worker tracking.',
      icon: Scan,
      path: '/digital-twin',
      accent: 'text-blue-400 border-blue-500/20 group-hover:border-blue-500/40 group-hover:shadow-blue-500/10'
    },
    {
      title: 'Incident Register',
      description: 'Log, investigate, and resolve safety incidents with AI-generated root cause reports.',
      icon: FileText,
      path: '/incidents',
      accent: 'text-red-400 border-red-500/20 group-hover:border-red-500/40 group-hover:shadow-red-500/10'
    },
    {
      title: 'AI Workspace',
      description: 'Deep-dive risk diagnostics, ML scoring breakdowns, and multi-agent reasoning trails.',
      icon: BrainCircuit,
      path: '/analysis',
      accent: 'text-safety-orange border-safety-orange/20 group-hover:border-safety-orange/40 group-hover:shadow-safety-orange/10'
    },
    {
      title: 'Safety Assistant',
      description: 'Ask natural-language questions and get regulatory-cited safety guidance instantly.',
      icon: MessageSquare,
      path: '/chatbot',
      accent: 'text-emerald-400 border-emerald-500/20 group-hover:border-emerald-500/40 group-hover:shadow-emerald-500/10'
    },
    {
      title: 'Data Storytelling',
      description: 'Time-series sensor trends, historical anomalies, and plant performance charts.',
      icon: BarChart3,
      path: '/analytics',
      accent: 'text-cyan-400 border-cyan-500/20 group-hover:border-cyan-500/40 group-hover:shadow-cyan-500/10'
    },
    {
      title: 'Compliance Audits',
      description: 'Real-time OISD & Factories Act audit tracking with automated corrective actions.',
      icon: BookOpen,
      path: '/compliance',
      accent: 'text-amber-400 border-amber-500/20 group-hover:border-amber-500/40 group-hover:shadow-amber-500/10'
    },
    {
      title: 'Shift Handover',
      description: 'Compile permits, isolations, gas logs, and AI summaries into a signed handover report.',
      icon: FileText,
      path: '/handover',
      accent: 'text-indigo-400 border-indigo-500/20 group-hover:border-indigo-500/40 group-hover:shadow-indigo-500/10'
    },
    ...(user && (user.role === 'Safety Officer' || user.role === 'Plant Manager') ? [{
      title: 'Gatehouse Approvals',
      description: 'Review and approve pending safety officer sponsorship & access requests.',
      icon: Users,
      path: '/admin',
      accent: 'text-slate-300 border-white/10 group-hover:border-white/20 group-hover:shadow-white/5'
    }] : [])
  ];

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
            <span suppressHydrationWarning>OVERALL RISK: {overallRisk.toUpperCase()}</span>
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
              <h2 suppressHydrationWarning className="font-heading text-2xl font-bold text-white tracking-tight">
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

          {/* Feature Navigation Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading text-base font-bold text-white tracking-wide">Explore the Platform</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Jump into any module for deeper analysis and control</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {FEATURE_CARDS.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.path}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                  >
                    <Link href={card.path} className="group block h-full">
                      <div className={`h-full p-5 rounded-2xl bg-white/[0.02] border transition-all duration-300 flex flex-col justify-between gap-6 hover:bg-white/[0.04] hover:-translate-y-1 hover:shadow-xl ${card.accent}`}>
                        <div className="flex items-start justify-between">
                          <div className={`w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center transition-colors ${card.accent}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1.5">{card.title}</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">{card.description}</p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>

      </div>

    </div>
  );
}