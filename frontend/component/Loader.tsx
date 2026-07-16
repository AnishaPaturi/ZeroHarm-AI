'use client';

import React from 'react';
import { BrainCircuit, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface LoaderProps {
  progressStep: number;
  totalSteps?: number;
  detailText: string;
}

export default function Loader({ progressStep, totalSteps = 7, detailText }: LoaderProps) {
  const percent = Math.min(Math.round(((progressStep + 1) / totalSteps) * 100), 100);

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      {/* Immersive Pulsing Core */}
      <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
        <motion.div 
          className="absolute inset-0 bg-safety-orange/10 rounded-full border border-safety-orange/30"
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.2, 0.6] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute inset-2 bg-gradient-to-tr from-safety-orange/20 to-amber-500/20 rounded-full border border-white/5"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        />
        <div className="relative w-12 h-12 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-safety-orange shadow-inner">
          <BrainCircuit className="w-6 h-6 animate-pulse" />
        </div>
      </div>

      <h3 className="font-heading font-bold text-lg text-white mb-2">
        Synthesizing Incident RAG Logs
      </h3>

      <div className="w-full max-w-sm mb-4">
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-2">
          <motion.div 
            className="h-full bg-gradient-to-r from-safety-orange to-amber-500 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
          <span>PIPELINE SATURATION</span>
          <span>{percent}%</span>
        </div>
      </div>

      <div className="bg-white/[0.02] border border-white/5 rounded-xl px-4 py-2.5 max-w-md shadow-sm">
        <p className="text-xs text-slate-300 font-medium tracking-wide">
          {detailText}
        </p>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase mt-6 tracking-widest">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>COMPUTING MODEL PARAMETERS</span>
      </div>
    </div>
  );
}
