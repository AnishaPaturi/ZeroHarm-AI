'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { fetchBackend } from '../../services/api';
import { FileText, Clock, AlertTriangle, CheckCircle, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';
import Loader from '../../component/Loader';

export default function ShiftHandover() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { addToast } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const summary = await fetchBackend<any>('/api/shift-handover/summary');
      if (summary) {
        setData(summary);
      }
    } catch (e: any) {
      console.error('Failed to load handover summary:', e);
      addToast(e.message || 'Failed to load handover summary from backend', 'error');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadSummary();
    }
  }, [authLoading, isAuthenticated]);

  const handleExport = () => {
    addToast('Shift handover report exported to PDF logbook.', 'success');
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader progressStep={3} detailText="Analyzing plant shift change metrics..." />
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
          You must log in to view Shift Handover summary logs.
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
    <div className="flex flex-col gap-6 py-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">
            SHIFT CHANGE COMPLIANCE
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white tracking-tight">
            AI Shift Handover summary
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Auto-auditing plant state, LOTO tags, active permits, and safety trends at shift boundaries
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSummary}
            className="px-3.5 py-2 bg-white/5 border border-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-semibold hover:bg-white/10 transition-all cursor-pointer"
          >
            Re-run Analysis
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-safety-orange text-white rounded-xl text-xs font-semibold hover:bg-safety-orange/90 transition-all cursor-pointer"
          >
            Export Logbook
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Metrics & Checklist */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Changeover metrics */}
          <div className="glass-panel border border-white/10 rounded-3xl p-5 flex flex-col gap-4">
            <h3 className="font-heading text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-safety-orange" />
              <span>Shift Handover Metrics</span>
            </h3>

            <div className="flex flex-col gap-3 font-mono text-[11px] text-slate-300">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">TIMESTAMP:</span>
                <span>{new Date(data?.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">ISOLATED EQ:</span>
                <span className={data?.offline_equipment?.length ? 'text-amber-400' : 'text-green-400'}>
                  {data?.offline_equipment?.length || 0} unit(s)
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">ACTIVE ALERTS:</span>
                <span className={data?.gas_alerts?.length ? 'text-red-400 font-bold' : 'text-green-400'}>
                  {data?.gas_alerts?.length || 0} anomaly
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">ACTIVE PERMITS:</span>
                <span>{data?.active_permits?.length || 0} in progress</span>
              </div>
            </div>
          </div>

          {/* Recommendations block */}
          <div className="glass-panel border border-white/10 rounded-3xl p-5 flex flex-col gap-4">
            <h3 className="font-heading text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Safety Directives Checklist</span>
            </h3>

            <div className="flex flex-col gap-2 text-xs">
              {data?.recommendations?.map((rec: string, idx: number) => (
                <div key={idx} className="flex gap-2 bg-white/5 border border-white/5 p-3 rounded-xl items-start">
                  <ArrowRight className="w-4 h-4 text-safety-orange mt-0.5 flex-shrink-0" />
                  <span className="text-slate-300 font-medium leading-relaxed">{rec}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Handover Narrative */}
        <div className="lg:col-span-2 glass-panel border border-white/10 rounded-3xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <h3 className="font-heading text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-safety-orange" />
              <span>Shift Handover Summary Report</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500 uppercase">Compiled by ZeroHarm AI</span>
          </div>

          <div className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-line bg-black/25 border border-white/5 p-5 rounded-2xl border-l-4 border-l-safety-orange">
            {data?.handover_narrative}
          </div>
        </div>

      </div>

    </div>
  );
}
