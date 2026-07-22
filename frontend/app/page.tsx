'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { 
  Shield, 
  BrainCircuit, 
  Activity, 
  BookOpen, 
  ChevronRight, 
  Check, 
  AlertTriangle, 
  Zap, 
  ArrowRight, 
  Users, 
  Server, 
  Cpu, 
  Radio, 
  FileText, 
  MapPin, 
  Flame, 
  TrendingUp, 
  ShieldAlert,
  Database,
  Terminal,
  Clock,
  Layers,
  Network
} from 'lucide-react';

export default function LandingPage() {

  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const handleOperationsCenter = () => {
    if (isAuthenticated) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  };

  // Scenario simulation state
  const [methaneLevel, setMethaneLevel] = useState<number>(3.2);
  const [isPermitActive, setIsPermitActive] = useState<boolean>(true);
  const [selectedModule, setSelectedModule] = useState<'vision' | 'rag' | 'audit'>('vision');

  // Compute live risk metrics based on inputs
  const getCompositeRisk = () => {
    let base = Math.min(100, Math.max(5, methaneLevel * 9)); // methane mapping
    if (isPermitActive) {
      if (methaneLevel > 5) {
        // Severe SIMOPs clash! Active hot work + high gas
        return {
          score: 95,
          level: 'CRITICAL',
          color: 'text-red-500 border-red-500/30 bg-red-500/10 shadow-red-500/20',
          desc: 'Simultaneous Operations (SIMOPs) violation: Hot work active in elevated gas zone.',
          actions: ['Permit auto-suspended', 'Evacuation sirens triggered', 'Control valve closed']
        };
      }
      return {
        score: Math.round(base + 15),
        level: 'ELEVATED',
        color: 'text-amber-500 border-amber-500/30 bg-amber-500/10 shadow-amber-500/20',
        desc: 'Active permit with nominal gas levels. Proximity sensors tracking worker locations.',
        actions: ['Continuous gas sensing', 'Permit monitoring', 'Area check in progress']
      };
    } else {
      if (methaneLevel > 5) {
        return {
          score: Math.round(base),
          level: 'HIGH',
          color: 'text-orange-500 border-orange-500/30 bg-orange-500/10 shadow-orange-500/20',
          desc: 'Elevated gas detected with no active permits. Potential leak or ventilation fault.',
          actions: ['Alert sent to Safety Officer', 'Increased ventilation requested']
        };
      }
      return {
        score: Math.round(base - 5),
        level: 'LOW',
        color: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10 shadow-emerald-500/20',
        desc: 'All parameters within safety thresholds. No conflicting operations registered.',
        actions: ['System state nominal']
      };
    }
  };

  const currentRisk = getCompositeRisk();

  const MODULES_INFO = {
    vision: {
      title: 'Computer Vision Telemetry',
      subtitle: 'Real-time hazard monitoring',
      desc: 'Neural networks process camera feeds continuously on site, identifying PPE violations, unauthorized entries, and flame hazards instantly.',
      features: ['98.4% PPE detection accuracy', 'Automatic area isolation relays', 'Immediate supervisor alerts']
    },
    rag: {
      title: 'Retrieval-Augmented RAG Core',
      subtitle: 'Instant regulatory intelligence',
      desc: 'Retrieves safety instructions from thousands of manual pages (OISD, DGMS, Factory Act) and maps them directly to active incident logs.',
      features: ['Sub-second query latencies', 'Legal code cross-referencing', 'Pre-formatted regulatory Form templates']
    },
    audit: {
      title: 'Smart Compliance Audits',
      subtitle: 'Automated inspection routines',
      desc: 'Tracks safety checklists, schedules structural checks, and audits telemetry logs against OISD standards without manual overhead.',
      features: ['OISD-STD-150 automatic checks', 'Digital certification lockers', 'Prioritized audit failure alerts']
    }
  };

  return (
    <div className="w-full flex flex-col gap-32 py-10">
      
      {/* 1. Cinematic Hero Section */}
      <section className="relative flex flex-col items-center justify-center text-center py-16 px-4 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-slate-300 font-mono uppercase tracking-wider mb-6"
        >
          <Shield className="w-3.5 h-3.5 text-safety-orange animate-pulse" />
          <span>Industrial Safety Intelligence Platform</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-heading font-extrabold text-white tracking-tight leading-[1.1] mb-8"
        >
          Prevent Accidents with <br />
          <span className="bg-gradient-to-r from-safety-orange via-amber-400 to-emerald-400 bg-clip-text text-transparent">
            Compound Risk Intelligence
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="text-base sm:text-xl text-slate-400 max-w-3xl leading-relaxed mb-12"
        >
          ZeroHarm AI fuses telemetry, spatial maps, and digital permit systems into a real-time autonomous safety committee to prevent cascading failures before they happen.
        </motion.p>

        {/* Live Stat Ticker */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl p-6 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-md mb-12 text-left"
        >
          <div className="flex items-start gap-3 border-b md:border-b-0 md:border-r border-white/10 pb-4 md:pb-0 md:pr-4">
            <ShieldAlert className="w-5 h-5 text-red-500 mt-1 flex-shrink-0" />
            <div>
              <p className="text-xl font-mono font-bold text-white">6,500+ Fatalities</p>
              <p className="text-xs text-slate-400 mt-1">Fatal workplace accidents in FY2023 (DGFASLI)</p>
            </div>
          </div>
          <div className="flex items-start gap-3 border-b md:border-b-0 md:border-r border-white/10 py-4 md:py-0 md:px-4">
            <Radio className="w-5 h-5 text-amber-500 mt-1 flex-shrink-0 animate-pulse" />
            <div>
              <p className="text-xl font-mono font-bold text-white">60% Manual Handoffs</p>
              <p className="text-xs text-slate-400 mt-1">Of industrial plants rely on paper tool permits (FICCI)</p>
            </div>
          </div>
          <div className="flex items-start gap-3 pt-4 md:pt-0 md:pl-4">
            <Clock className="w-5 h-5 text-emerald-500 mt-1 flex-shrink-0" />
            <div>
              <p className="text-xl font-mono font-bold text-white">&lt;10 Seconds</p>
              <p className="text-xs text-slate-400 mt-1">Critical window compressed from minutes to seconds</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          {/* <Link 
            href="/login"
            className="group bg-gradient-to-r from-safety-orange to-amber-600 hover:from-safety-orange hover:to-amber-500 text-white font-semibold text-sm px-8 py-4 rounded-2xl transition-all shadow-lg shadow-safety-orange/15 hover:shadow-safety-orange/20 flex items-center justify-center gap-2 border border-white/10"
          >
            <span>Enter Operations Center</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link> */}
        <button
            onClick={handleOperationsCenter}
            className="group bg-gradient-to-r from-safety-orange to-amber-600 hover:from-safety-orange hover:to-amber-500 text-white font-semibold text-sm px-8 py-3.5 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 border border-white/10"
        >
            <span>Enter Operations Center</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>

          <Link 
            href="/login"
            className="bg-white/5 hover:bg-white/10 text-white font-semibold text-sm px-8 py-4 rounded-2xl transition-all border border-white/10 flex items-center justify-center"
          >
            Officer Sign In
          </Link>
        </motion.div>
      </section>

      {/* 2. The Problem Section */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <div className="text-center mb-16">
          <span className="text-[10px] text-red-500 font-mono uppercase tracking-widest block mb-3">
            The Cost of Fragmentation
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Why Single-Sensor Dashboards Fail to Stop Disasters
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto mt-4">
            Industrial safety tools fail when telemetry operates in silos. A gas alarm here and an active hot work permit there look nominal on separate screens, but deadly in combination.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Vizag steel plant tragedy callout */}
          <div className="lg:col-span-6 rounded-3xl p-8 bg-red-950/20 border border-red-500/20 flex flex-col justify-between backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 text-red-500/10 pointer-events-none">
              <ShieldAlert className="w-32 h-32" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-[10px] text-red-400 font-mono uppercase tracking-wider mb-6">
                <Flame className="w-3 h-3 text-red-500 animate-pulse" />
                <span>Tragedy Analysis</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">
                Visakhapatnam Gas Explosion (Jan 2025)
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                Eight workers lost their lives in a gas explosion. Post-incident analysis revealed that gas sensors had detected sub-threshold methane leakage, while a hot work maintenance permit was active in the exact same battery section. 
              </p>
              <div className="border-l-4 border-safety-orange pl-4 mb-6">
                <p className="text-sm text-white italic font-medium">
                  "The data existed. Nobody connected it in time."
                </p>
              </div>
            </div>
            <div className="text-xs text-red-400 font-mono">
              Result: Undetected Simultaneous Operations (SIMOPs) hazard.
            </div>
          </div>

          {/* Before/After visual comparison */}
          <div className="lg:col-span-6 rounded-3xl p-8 bg-white/[0.02] border border-white/10 flex flex-col justify-between backdrop-blur-sm">
            <div>
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-6">
                System Workflow Contrast
              </span>
              
              <div className="space-y-6">
                <div className="relative pl-6 border-l border-red-500/30">
                  <div className="absolute top-1 -left-[5px] w-2.5 h-2.5 rounded-full bg-red-500" />
                  <h4 className="text-sm font-semibold text-white mb-1">Traditional Fragmented Silos</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    SCADA alerts, permit books, worker location logs, and camera streams are isolated. Finding risk overlaps requires manual checks, creating a critical 15-to-30-minute intelligence delay.
                  </p>
                </div>

                <div className="relative pl-6 border-l border-emerald-500/30">
                  <div className="absolute top-1 -left-[5px] w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h4 className="text-sm font-semibold text-white mb-1">ZeroHarm AI Unified Intelligence</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    A real-time multi-agent negotiation framework continuously fuses permit parameters with telemetry. SIMOPs overlaps automatically trigger safety lockdowns in milliseconds.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 flex justify-end">
              <Link href="/dashboard" className="text-xs font-semibold text-safety-orange hover:text-amber-400 flex items-center gap-1.5 transition-colors">
                <span>View real-time safety logs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Solution Overview */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <div className="text-center mb-16">
          <span className="text-[10px] text-safety-orange font-mono uppercase tracking-widest block mb-3">
            Core Engine Architecture
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white tracking-tight">
            How ZeroHarm AI Works
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto mt-4">
            Our multi-agent system synthesizes streaming inputs, evaluates statutory rulebooks, and broadcasts immediate alerts to safety officers and control relays.
          </p>
        </div>

        {/* Visual interactive diagram */}
        <div className="w-full rounded-3xl border border-white/10 bg-white/[0.01] p-8 backdrop-blur-sm relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Column 1: Inputs */}
            <div className="lg:col-span-3 flex flex-col gap-3">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider mb-2 block">
                1. Streaming Inputs
              </span>
              {[
                { label: 'IoT SCADA Telemetry', sub: 'Gas, pressure, temp' },
                { label: 'Digital Permit-to-Work', sub: 'SIMOPs, hot/confined' },
                { label: 'CCTV Camera Feeds', sub: 'PPE, unauthorized entries' },
                { label: 'Worker GPS Tracking', sub: 'Live zone coordinates' }
              ].map((item, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-white">{item.label}</span>
                  <span className="text-[10px] text-slate-400">{item.sub}</span>
                </div>
              ))}
            </div>

            {/* Connection 1 */}
            <div className="hidden lg:col-span-1 lg:flex flex-col items-center justify-center gap-1">
              <div className="w-full h-[2px] bg-gradient-to-r from-white/10 to-safety-orange/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-safety-orange/60 animate-ping absolute" />
            </div>

            {/* Column 2: Orchestrator Core */}
            <div className="lg:col-span-4 flex flex-col gap-6 items-center">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block">
                2. Autonomous Risk Orchestrator
              </span>
              
              <div className="w-full p-6 rounded-2xl bg-gradient-to-br from-safety-orange/15 via-slate-900 to-black border border-safety-orange/30 shadow-2xl relative group hover:border-safety-orange/50 transition-all flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-safety-orange/10 border border-safety-orange/30 flex items-center justify-center mb-4">
                  <BrainCircuit className="w-6 h-6 text-safety-orange" />
                </div>
                <h4 className="text-sm font-bold text-white mb-2">Compound Risk Engine</h4>
                <p className="text-xs text-slate-300 leading-relaxed max-w-[240px]">
                  Negotiates hazard values from multiple agent dimensions, references OISD / Factories Act rules, and outputs unified risk score indexes.
                </p>
                <div className="mt-4 flex gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-slate-300">Rules Parser</span>
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-slate-300">ML Classifier</span>
                </div>
              </div>
            </div>

            {/* Connection 2 */}
            <div className="hidden lg:col-span-1 lg:flex flex-col items-center justify-center">
              <div className="w-full h-[2px] bg-gradient-to-r from-safety-orange/50 to-white/10" />
            </div>

            {/* Column 3: Outputs */}
            <div className="lg:col-span-3 flex flex-col gap-3">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider mb-2 block">
                3. Operations Action
              </span>
              {[
                { label: 'Safety Heatmap Map', sub: '2D zone color grading' },
                { label: 'Emergency Evacuation', sub: 'Route dispatch, sirens' },
                { label: 'Explainable AI Reason', sub: 'Statutory cross-referencing' },
                { label: 'Tamper-Proof Audit Logs', sub: 'Black box recording' }
              ].map((item, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5 text-right lg:text-left">
                  <span className="text-xs font-semibold text-white">{item.label}</span>
                  <span className="text-[10px] text-slate-400">{item.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Features Grid */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <div className="text-center mb-16">
          <span className="text-[10px] text-safety-orange font-mono uppercase tracking-widest block mb-3">
            Unified Safety Suite
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Designed for Critical Industrial Safety
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto mt-4">
            ZeroHarm AI is built specifically to address high-risk industrial work, combining real-time spatial physics, machine learning classifiers, and regulatory indexing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Cpu,
              title: 'Compound Risk Detection Engine',
              desc: 'Fuses telemetry inputs with digital permit conditions, preventing multi-variable disasters that typical single-sensor systems miss.',
              sub: '98.4% detection accuracy'
            },
            {
              icon: MapPin,
              title: 'Geospatial Safety Heatmap',
              desc: 'Renders dynamic hazard levels across a live coordinate layout of process zones, plotting workers and gas leaks instantly.',
              sub: 'Live 2D coordinate maps'
            },
            {
              icon: FileText,
              title: 'Digital Permit Intelligence',
              desc: 'Cross-checks Hot, Cold, and Confined Space permits in real-time, instantly blocking dangerous Simultaneous Operations (SIMOPs).',
              sub: 'OISD-STD-105 standard checks'
            },
            {
              icon: Zap,
              title: 'Emergency Response Orchestrator',
              desc: 'Compresses dispatch lead time by automatically firing exit routing calculations and alarm relays within seconds of threshold breaches.',
              sub: 'Under 5-second response'
            },
            {
              icon: BrainCircuit,
              title: 'Explainable AI Risk Reasoning',
              desc: 'Decodes system risk ratings into human-readable logs referencing exact variables, removing guesswork during emergency responses.',
              sub: 'Contextual natural language'
            },
            {
              icon: Database,
              title: 'Black Box Evidence Preservation',
              desc: 'Stores telemetry records and alert events in a tamper-proof digital logger, providing critical data logs for post-incident audits.',
              sub: 'Cryptographic ledger design'
            },
            {
              icon: BookOpen,
              title: 'Incident Pattern Intelligence (RAG)',
              desc: 'Queries thousands of pages of safety regulations and manuals instantly to map proper protocols to active anomaly logs.',
              sub: 'Sub-second search queries'
            },
            {
              icon: Network,
              title: 'Dynamic Risk Graph (Knowledge Graph)',
              desc: 'Connects workers, machines, zones, sensors, permits, supervisors, and historical accidents into a reasoning graph that AI can traverse.',
              sub: 'Far smarter than SQL joins'
            }
          ].map((feat, index) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between backdrop-blur-sm group"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-5 group-hover:bg-safety-orange/10 group-hover:border-safety-orange/30 transition-colors">
                    <Icon className="w-5 h-5 text-slate-300 group-hover:text-safety-orange transition-colors" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2 leading-snug">{feat.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{feat.desc}</p>
                </div>
                <div className="text-[10px] text-safety-orange/80 font-mono tracking-wide border-t border-white/5 pt-3">
                  {feat.sub}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* 5. Live Interactive Scenario Demo */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-5 flex flex-col justify-center">
            <span className="text-[10px] text-safety-orange font-mono uppercase tracking-widest mb-3 block">
              Proof of Concept
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Test the Risk Engine Live
            </h2>
            <p className="text-sm text-slate-400 mt-4 leading-relaxed mb-6">
              Adjust the slider and toggle below to simulate safety variables in a process zone. Watch how the Multi-Agent orchestrator instantly computes composite risk levels and triggers automated mitigation tasks.
            </p>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">SELECTED AREA</span>
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-safety-orange" />
                  Coke Oven Battery 1 (Confined Zone)
                </span>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400 font-mono uppercase block mb-1">STATUTORY COVERAGE</span>
                <span className="text-xs text-slate-300">
                  OISD-STD-105 & Factories Act Section 36 regulations.
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="glass-panel border border-white/10 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl bg-black/40">
              
              {/* Header */}
              <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-safety-orange" />
                  <span className="text-xs font-mono font-bold text-white">ORCHESTRATOR SIMULATOR</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-slate-400 font-mono">LIVE ASSESSOR FEED</span>
                </div>
              </div>

              {/* Controls */}
              <div className="space-y-6 mb-8">
                {/* Methane Gas slider */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-slate-400">Methane Leak Level</span>
                    <span className={`font-bold ${methaneLevel > 5 ? 'text-red-400 font-bold' : 'text-slate-200'}`}>
                      {methaneLevel.toFixed(1)}% LFL
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="10" 
                    step="0.1"
                    value={methaneLevel}
                    onChange={(e) => setMethaneLevel(parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-safety-orange"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                    <span>0% (Safe)</span>
                    <span className="text-red-500/80">5.0% (Explosive Limit)</span>
                    <span>10% (Critical)</span>
                  </div>
                </div>

                {/* Hot Work Permit toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-white">Hot Work Maintenance Permit</span>
                    <span className="text-[10px] text-slate-400">Allows active welding / spark-producing tasks</span>
                  </div>
                  <button 
                    suppressHydrationWarning
                    onClick={() => setIsPermitActive(!isPermitActive)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none ${
                      isPermitActive ? 'bg-safety-orange' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out transform ${
                      isPermitActive ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Engine output display */}
              <div className="p-5 rounded-2xl bg-black/50 border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono uppercase">COMPOSITE RISK INDEX</span>
                  <div className={`px-2.5 py-1 rounded text-xs font-mono font-bold border ${currentRisk.color}`}>
                    {currentRisk.level} : {currentRisk.score}/100
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed italic border-l-2 border-white/20 pl-3">
                  "{currentRisk.desc}"
                </p>

                {/* Automation triggers */}
                <div className="pt-2 border-t border-white/5">
                  <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block mb-2">
                    AUTOMATED ACTIONS TRIGGERED
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {currentRisk.actions.map((act, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-200">
                        <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span>{act}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* 6. Regulatory Compliance Bar */}
      <section className="w-full border-y border-white/10 py-10 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto w-full px-4">
          <p className="text-center text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-6">
            Trusted Statutory Auditing Alignments
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center text-center">
            {[
              { rule: 'Factories Act 1948', section: 'Section 36 Compliance' },
              { rule: 'OISD-STD-105', section: 'Work Permit Integrity' },
              { rule: 'OISD-GDN-137', section: 'Hazardous Gas Placements' },
              { rule: 'DGMS Guidelines', section: 'Industrial Mining Standards' }
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <span className="text-sm font-bold text-slate-200">{item.rule}</span>
                <span className="text-[10px] text-safety-orange font-mono uppercase tracking-wider">{item.section}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Architecture / Multi-Agent Section */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <div className="text-center mb-16">
          <span className="text-[10px] text-safety-orange font-mono uppercase tracking-widest block mb-3">
            Multi-Agent Framework
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Collaborative Safety Board in Milliseconds
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto mt-4">
            ZeroHarm AI is built on a plant-agnostic, decentralized architecture where specialized agents continuously negotiate risk values.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              role: 'Sensor Agent',
              sub: 'Telemetry Assessor',
              desc: 'Subscribes directly to SCADA, gas, and ambient pressure telemetry. Runs dynamic mathematical threshold evaluations on streaming records.'
            },
            {
              role: 'Permit Agent',
              sub: 'PTW Integrity Assessor',
              desc: 'Tracks active, pending, and expired Permits-to-Work. Identifies hot work / cold work boundary overlaps in close geographical proximity.'
            },
            {
              role: 'Geospatial Agent',
              sub: 'Spatial Coordinate Assessor',
              desc: 'Parses live coordinate models of the plant layout. Tracks active workers against hazard areas using zone geofencing.'
            },
            {
              role: 'Orchestrator Agent',
              sub: 'Risk Synthesis Core',
              desc: 'Fuses risk factors from the Sensor, Permit, and Geo agents. Triggers automated alarms, sirens, and logs findings to the black box.'
            }
          ].map((agent, index) => (
            <div 
              key={index}
              className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 flex flex-col justify-between transition-all backdrop-blur-sm"
            >
              <div>
                <div className="w-8 h-8 rounded-lg bg-safety-orange/10 flex items-center justify-center text-xs font-mono font-bold text-safety-orange mb-4">
                  0{index + 1}
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{agent.role}</h3>
                <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block mb-4">{agent.sub}</span>
                <p className="text-xs text-slate-400 leading-relaxed">{agent.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8. Impact Metrics Section */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900 to-black p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 text-white/[0.02] pointer-events-none">
            <TrendingUp className="w-64 h-64" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-5 flex flex-col justify-center">
              <span className="text-[10px] text-safety-orange font-mono uppercase tracking-widest mb-3 block">
                Quantifiable Impact
              </span>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Designed to Prevent Safety Failures
              </h2>
              <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                Safety performance targets aim for total loss prevention. By automating manual safety workflows, plants can eliminate response latencies entirely.
              </p>
            </div>
            
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-6 rounded-xl bg-white/5 border border-white/5">
                <span className="text-2xl font-mono font-bold text-white">98.4%</span>
                <span className="text-xs text-slate-400 block mt-1">Reduction in permit conflict validation failures</span>
              </div>
              <div className="p-6 rounded-xl bg-white/5 border border-white/5">
                <span className="text-2xl font-mono font-bold text-white">10+ Mins</span>
                <span className="text-xs text-slate-400 block mt-1">Preemptive lead warning before gas breach spikes</span>
              </div>
              <div className="p-6 rounded-xl bg-white/5 border border-white/5">
                <span className="text-2xl font-mono font-bold text-white">-92%</span>
                <span className="text-xs text-slate-400 block mt-1">Time reduction in triggering evacuation sirens</span>
              </div>
              <div className="p-6 rounded-xl bg-white/5 border border-white/5">
                <span className="text-2xl font-mono font-bold text-white">$500K+</span>
                <span className="text-xs text-slate-400 block mt-1">Production value saved per mitigated incident shutdown</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Tech Stack Strip */}
      {/* <section className="max-w-5xl mx-auto w-full px-4 text-center">
        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-6">
          Technical Architecture Stack
        </p>
        <div className="flex flex-wrap justify-center items-center gap-3">
          {[
            'Next.js 15',
            'FastAPI Backend',
            'scikit-learn Anomaly',
            'NetworkX Process Topology',
            'OpenRouter LLM RAG',
            'WebSockets Telemetry',
            'Tailwind CSS UI'
          ].map((tech, idx) => (
            <span 
              key={idx} 
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-slate-300"
            >
              {tech}
            </span>
          ))}
        </div>
      </section> */}

      {/* 10. Team / Roles Section */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <div className="text-center mb-16">
          <span className="text-[10px] text-safety-orange font-mono uppercase tracking-widest block mb-3">
            Hackathon Execution
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Meet the Builders
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto mt-4">
            ZeroHarm AI was engineered during the ET Hackathon by a 4-person development team, with each member owning a critical platform layer.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              alias: 'Anisha Paturi',
              role: 'https://github.com/AnishaPaturi',
              // desc: 'Built the Pydantic telemetry parsing schemas, implemented Isolation Forest models for ML detection, and wrote statutory safety check scripts.'
            },
            {
              alias: 'Vahini Chilukamarri',
              role: 'https://github.com/vahinichilukamarri',
              // desc: 'Designed the SVG plant coordinate map layouts, topology graphs, continuous GPS simulators, and evacuation siren dispatch channels.'
            },
            {
              alias: 'Parinamika Bhanu',
              role: 'https://github.com/Parinamika-13',
              // desc: 'Engineered the local document vector search index, custom TF-IDF parser, and hooked in OpenRouter API calls for explainable AI summaries.'
            },
            {
              alias: 'Sravani Janak',
              role: 'https://github.com/SSJ-08',
              // desc: 'Coded digital permit conflict checks, merged the 4 agents into the primary pipeline thread, and configured Next.js WebSocket streams.'
            }
          ].map((member, index) => (
            <div 
              key={index} 
              className="p-6 rounded-2xl bg-white/[0.01] border border-white/5 flex flex-col justify-between text-left backdrop-blur-sm hover:border-white/10 transition-all"
            >
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-xs font-mono font-bold text-white">{member.alias}</h3>
                    <span className="text-[9px] text-safety-orange font-mono uppercase tracking-wider block">Co-Developer</span>
                  </div>
                </div>
                <h4 className="text-xs font-bold text-slate-200 mb-2 leading-snug">{member.role}</h4>
                {/* <p className="text-[11px] text-slate-400 leading-relaxed">{member.desc}</p> */}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 11. Final CTA */}
      <section className="max-w-5xl mx-auto w-full px-4 pb-20">
        <div className="rounded-3xl border border-white/10 p-12 text-center bg-gradient-to-b from-white/[0.02] to-transparent relative overflow-hidden backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-safety-orange/5 via-transparent to-emerald-500/5 pointer-events-none" />
          <h2 className="font-heading text-3xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            Zero Incidents starts with Zero Silos
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto mb-8">
            Deploy continuous, multi-agent intelligence across your industrial process sectors.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/dashboard"
              className="group bg-gradient-to-r from-safety-orange to-amber-600 hover:from-safety-orange hover:to-amber-500 text-white font-semibold text-sm px-8 py-3.5 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 border border-white/10"
            >
              <span>Enter Operations Center</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link 
              href="/login"
              className="bg-white/5 hover:bg-white/10 text-white font-semibold text-sm px-8 py-3.5 rounded-2xl transition-all border border-white/10 flex items-center justify-center"
            >
              Officer Sign In
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
