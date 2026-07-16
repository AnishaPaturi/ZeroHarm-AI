'use client';

import React from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { BellRing, Key } from 'lucide-react';

export default function SettingsPage() {
  const { addToast } = useNotifications();

  return (
    <div className="flex flex-col gap-6 py-4 max-w-xl mx-auto">
      <div>
        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">CONTROL PANEL</span>
        <h1 className="font-heading text-2xl font-bold text-white tracking-tight">System Settings</h1>
      </div>

      <div className="glass-panel border border-white/10 rounded-3xl p-6 flex flex-col gap-6 text-xs">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BellRing className="w-4 h-4 text-safety-orange" />
            <div>
              <h4 className="font-semibold text-slate-200">Real-Time Alerts</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Toggle browser push notifications on gas triggers.</p>
            </div>
          </div>
          <button
            onClick={() => addToast('Notification preferences updated', 'success')}
            className="px-3.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 transition-all font-semibold cursor-pointer"
          >
            Disable
          </button>
        </div>

        <div className="flex justify-between items-center border-t border-white/5 pt-6">
          <div className="flex items-center gap-3">
            <Key className="w-4 h-4 text-safety-orange" />
            <div>
              <h4 className="font-semibold text-slate-200">API Connection Keys</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Manage token configurations for RAG models.</p>
            </div>
          </div>
          <button
            onClick={() => addToast('API keys regenerated', 'success')}
            className="px-3.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 transition-all font-semibold cursor-pointer"
          >
            Configure
          </button>
        </div>
      </div>
    </div>
  );
}
