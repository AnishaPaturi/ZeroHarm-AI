'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { useShallow } from 'zustand/react/shallow';
import { useIncident, selectSafetyBriefings } from '../../hooks/useIncident';
import { FileText, Download, ShieldAlert } from 'lucide-react';

export default function ReportsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { addToast } = useNotifications();
  const reports = useIncident(useShallow(selectSafetyBriefings));

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
          You must log into the platform gateway to view Executive Briefings.
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
    <div className="flex flex-col gap-6 py-4 max-w-2xl mx-auto">
      <div>
        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">REPORT GENERATOR</span>
        <h1 className="font-heading text-2xl font-bold text-white tracking-tight">Executive Briefings</h1>
      </div>

      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 flex flex-col gap-4">
        {reports.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center py-6">No reports generated yet. Add safety data or compliance audits to build files.</p>
        ) : (
          reports.map((rep) => (
            <div key={rep.id} className="p-4 rounded-xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.02] transition-colors flex justify-between items-center text-xs">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-safety-orange" />
                <div>
                  <h4 className="font-semibold text-slate-200">{rep.name}</h4>
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{rep.date} • {rep.size}</span>
                  <p className="text-[10px] text-slate-400 mt-1">{rep.description}</p>
                </div>
              </div>
              <button
                onClick={() => addToast(`Report "${rep.name}" downloaded`, 'success')}
                className="p-2.5 rounded-lg bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
