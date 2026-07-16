'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, BrainCircuit, Activity, BookOpen, ChevronRight, Check } from 'lucide-react';

export default function LandingPage() {
  const [selectedModule, setSelectedModule] = useState<'vision' | 'rag' | 'audit'>('vision');

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
    <div className="w-full flex flex-col gap-24 py-10">
      
      {/* Cinematic Hero */}
      <section className="relative flex flex-col items-center justify-center text-center py-20 px-4 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-slate-300 font-mono uppercase tracking-wider mb-6"
        >
          <Shield className="w-3.5 h-3.5 text-safety-orange animate-pulse" />
          <span>Industrial Safety Intelligence Platform</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-4xl sm:text-6xl font-heading font-bold text-white tracking-tight leading-[1.1] mb-6"
        >
          Prevent Accidents with <br />
          <span className="bg-gradient-to-r from-safety-orange via-amber-400 to-emerald-400 bg-clip-text text-transparent">
            AI Operations Intelligence
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed mb-10"
        >
          ZeroHarm AI aggregates Computer Vision feeds, compliance books, and predictive telemetry into a single, unified Vision Pro-style safety operations deck.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link 
            href="/dashboard"
            className="group bg-gradient-to-r from-safety-orange to-amber-600 hover:from-safety-orange hover:to-amber-500 text-white font-semibold text-sm px-8 py-3.5 rounded-2xl transition-all shadow-lg shadow-safety-orange/15 hover:shadow-safety-orange/20 flex items-center justify-center gap-2 border border-white/10"
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
        </motion.div>
      </section>

      {/* Interactive Demonstration Panel */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="glass-panel border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Interactive Module Selectors */}
            <div className="lg:col-span-4 flex flex-col gap-4 justify-center">
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mb-1 block">
                CORE PIPELINE
              </span>
              <h2 className="font-heading text-2xl font-bold text-white tracking-tight">
                Enterprise Core Modules
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Toggle through active telemetry processes to view automated AI workflows.
              </p>

              <div className="flex flex-col gap-2">
                {[
                  { key: 'vision', label: 'Computer Vision', icon: Activity },
                  { key: 'rag', label: 'Regulatory RAG', icon: BrainCircuit },
                  { key: 'audit', label: 'Compliance Audit', icon: BookOpen }
                ].map((item) => {
                  const Icon = item.icon;
                  const selected = selectedModule === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setSelectedModule(item.key as any)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all focus:outline-none ${
                        selected 
                          ? 'bg-white/10 border-safety-orange text-white' 
                          : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${selected ? 'text-safety-orange' : ''}`} />
                      <span className="text-xs font-semibold">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Display Board */}
            <div className="lg:col-span-8 bg-black/45 border border-white/5 rounded-2xl p-6 flex flex-col justify-between shadow-inner min-h-[300px]">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] text-safety-orange font-mono uppercase bg-safety-orange/10 px-2 py-0.5 rounded border border-safety-orange/20">
                    {MODULES_INFO[selectedModule].subtitle}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">STATUS: ACTIVE</span>
                </div>
                <h3 className="font-heading text-lg font-bold text-white mb-2">
                  {MODULES_INFO[selectedModule].title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {MODULES_INFO[selectedModule].desc}
                </p>
              </div>

              <div className="border-t border-white/5 pt-4 mt-6">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-3">
                  Key Capabilities
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MODULES_INFO[selectedModule].features.map((feat, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-200">
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </motion.div>
      </section>

    </div>
  );
}
