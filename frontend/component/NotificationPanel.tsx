'use client';

import React from 'react';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { SafetyAlert } from '../types/analytics';
import { useIncident } from '../hooks/useIncident';
import { useNotifications } from '../hooks/useNotifications';
import { eventBus } from '../lib/eventBus';

interface NotificationPanelProps {
  onClose: () => void;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const alerts = useIncident(state => state.alerts);
  const { addToast } = useNotifications();

  const getAlertStyle = (severity: SafetyAlert['severity']) => {
    switch (severity) {
      case 'Critical':
        return {
          icon: <AlertCircle className="w-4 h-4 text-red-400" />,
          bg: 'bg-red-500/10 border-red-500/20 text-red-300',
          indicator: 'bg-red-500'
        };
      case 'Warning':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
          bg: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
          indicator: 'bg-amber-500'
        };
      case 'Info':
      default:
        return {
          icon: <Info className="w-4 h-4 text-blue-400" />,
          bg: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
          indicator: 'bg-blue-500'
        };
    }
  };

  const acknowledgeAlert = (id: string, message: string) => {
    eventBus.publish({
      type: 'AlertAcknowledged',
      payload: { alertId: id }
    });
    addToast(`Acknowledged alert: "${message.substring(0, 30)}..."`, 'success');
  };

  return (
    <div className="glass-panel border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5 flex justify-between items-center">
        <span className="font-heading font-semibold text-xs tracking-wider uppercase text-slate-300">
          Critical Operations Feed
        </span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Alert Feed */}
      <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
        {alerts.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No active safety alerts. All sectors stable.
          </div>
        ) : (
          alerts.map((alert) => {
            const styles = getAlertStyle(alert.severity);
            return (
              <div key={alert.id} className="p-4 hover:bg-white/[0.02] transition-colors relative flex items-start gap-3">
                <div className="mt-0.5">{styles.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">{alert.department}</span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 mt-1 font-medium leading-relaxed">
                    {alert.message}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className={`text-[8px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${styles.bg}`}>
                      {alert.severity}
                    </span>
                    <button
                      onClick={() => acknowledgeAlert(alert.id, alert.message)}
                      className="text-[10px] text-slate-400 hover:text-white font-semibold underline underline-offset-2"
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
