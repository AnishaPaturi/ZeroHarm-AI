'use client';

import React from 'react';
import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-safety-orange mb-4 animate-pulse">
        <Compass className="w-6 h-6" />
      </div>
      <h2 className="text-2xl font-heading font-bold text-white mb-2">404 — Sector Offline</h2>
      <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-6">
        The plant operations gateway cannot locate this segment telemetry mapping.
      </p>
      <Link 
        href="/" 
        className="bg-white/10 hover:bg-white/20 border border-white/10 text-white font-semibold text-xs px-6 py-2.5 rounded-xl transition-all"
      >
        Return to Operations Desk
      </Link>
    </div>
  );
}
