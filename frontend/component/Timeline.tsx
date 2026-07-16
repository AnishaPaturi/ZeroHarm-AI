'use client';

import React from 'react';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { IncidentTimelineEvent } from '../types/incident';
import { motion } from 'framer-motion';

interface TimelineProps {
  events: IncidentTimelineEvent[];
}

export default function Timeline({ events }: TimelineProps) {
  const getIcon = (status: IncidentTimelineEvent['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-400 fill-green-950/20" />;
      case 'current':
        return <Clock className="w-5 h-5 text-safety-orange animate-pulse" />;
      case 'pending':
      default:
        return <AlertCircle className="w-5 h-5 text-slate-600" />;
    }
  };

  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="relative pl-6 border-l border-white/10 flex flex-col gap-6"
    >
      {events.map((event, idx) => (
        <motion.div
          key={event.id || idx}
          variants={itemVariants}
          className="relative"
        >
          {/* Node Icon */}
          <span className="absolute -left-[37px] top-0 bg-slate-950 p-1.5 rounded-full border border-white/10 flex items-center justify-center z-10">
            {getIcon(event.status)}
          </span>

          {/* Card */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.04] transition-all">
            <div className="flex justify-between items-start gap-4">
              <h4 className="text-sm font-semibold text-white tracking-wide">{event.title}</h4>
              <span className="text-[10px] text-slate-400 font-mono bg-white/5 border border-white/5 px-2 py-0.5 rounded-md">
                {event.timestamp}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{event.description}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
