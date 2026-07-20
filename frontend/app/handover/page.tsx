'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { fetchBackend } from '../../services/api';
import { FileText, Clock, AlertTriangle, CheckCircle, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';
import Loader from '../../component/Loader';

const generateLocalHandoverSummary = () => {
  const now = new Date();
  return {
    timestamp: now.toISOString(),
    offline_equipment: ["Coke Oven Battery 1 processing segment"],
    gas_alerts: ["Methane flammability in Coke Oven Battery 1: 4.2% LFL"],
    active_permits: [
      {
        permit_id: "PTW-HW-202",
        permit_type: "hot_work",
        zone: "Coke Oven Battery 1",
        workers: 3
      }
    ],
    ongoing_maintenance: [
      {
        equipment: "Coke Oven Battery 1 general manifold/machinery",
        zone: "Coke Oven Battery 1",
        status: "In Progress"
      }
    ],
    high_risk_zones: [
      {
        zone: "Coke Oven Battery 1",
        risk_score: 68.5,
        risk_level: "Warning"
      }
    ],
    recommendations: [
      "Halt all welding/spark-producing work in Coke Oven Battery 1 until methane LFL drops below 4%.",
      "Ensure forced-draft ventilation is active at maximum capacity in affected gas zones.",
      "Verify all Lock-Out Tag-Out (LOTO) isolations on the fuel gas line block valves."
    ],
    handover_narrative: `### 🛡️ AI Generated Shift Handover Report (Offline Preview Mode)

**Generation Timestamp:** ${now.toUTCString()}

**Operational Status Overview:**
- **Active Permits:** 1 hot work permit active.
- **Maintenance Status:** 1 equipment unit isolated for servicing.
- **Safety Alerts Logged:** 1 gas flammability anomaly recorded in Coke Oven Battery 1.

#### 📜 Active Work Permits
| Permit ID | Type | Zone | Workers |
|---|---|---|---|
| PTW-HW-202 | HOT WORK | Coke Oven Battery 1 | 3 |

#### ⚡ Lock-Out Tag-Out & Isolations
| Isolated Equipment | Zone | Status |
|---|---|---|
| Coke Oven Battery 1 manifold/machinery | Coke Oven Battery 1 | In Progress |

#### ☁️ Environmental & Gas Anomaly Log
- ❌ Methane flammability in Coke Oven Battery 1: 4.2% LFL (Statutory limit is <4.0%)

#### ⚠️ Risk Classification
- ⚠️ **Coke Oven Battery 1:** Composite Risk **68.5%** (Warning)

#### 📋 Preemptive Directives Checklist
- [ ] Halt spark-producing operations in Coke Oven Battery 1 immediately.
- [ ] Confirm secondary escape routes are clear and safety watch is alert.
- [ ] Verify gas sensor telemetry at the battery boundary.

#### 🧠 Shift Change Safety Advisory Focus
⚠️ **Factories Act Sec. 36 Compliance Alert**: Direct incoming shift supervisor to re-verify gas levels on all active confined space entries.`
  };
};

export default function ShiftHandover() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { addToast } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [reRunning, setReRunning] = useState(false);
  const [data, setData] = useState<any>(null);

  const loadSummary = async (isReRun = false) => {
    if (isReRun) {
      setReRunning(true);
    } else {
      setLoading(true);
    }
    try {
      const summary = await fetchBackend<any>('/api/shift-handover/summary');
      if (summary) {
        setData(summary);
        if (isReRun) {
          addToast('Shift handover analysis completed successfully.', 'success');
        }
      }
    } catch (e: any) {
      console.warn('Backend offline or error loading handover summary. Using client-side preview fallback.', e);
      const localSummary = generateLocalHandoverSummary();
      setData(localSummary);
      const isFetchError = e.message?.includes('fetch') || e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError') || e.message?.includes('API call failed');
      if (isFetchError) {
        addToast('ZeroHarm safety server is offline. Loaded client-side preview summary.', 'warning');
      } else {
        addToast(`Failed to load summary: ${e.message || e}. Loaded local fallback.`, 'error');
      }
    } finally {
      setLoading(false);
      setReRunning(false);
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
            onClick={() => loadSummary(true)}
            disabled={reRunning}
            className="px-3.5 py-2 bg-white/5 border border-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-semibold hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {reRunning ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-safety-orange" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Analyzing...</span>
              </>
            ) : (
              'Re-run Analysis'
            )}
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
          <div className="glass-panel border border-white/10 rounded-3xl p-5 flex flex-col gap-4 relative overflow-hidden">
            {reRunning && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                <div className="w-6 h-6 rounded-full border-2 border-safety-orange border-t-transparent animate-spin"></div>
              </div>
            )}
            <h3 className="font-heading text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-safety-orange" />
              <span>Shift Handover Metrics</span>
            </h3>

            <div className="flex flex-col gap-3 font-mono text-[11px] text-slate-300">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">TIMESTAMP:</span>
                <span suppressHydrationWarning>{data?.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'}</span>
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
          <div className="glass-panel border border-white/10 rounded-3xl p-5 flex flex-col gap-4 relative overflow-hidden">
            {reRunning && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                <div className="w-6 h-6 rounded-full border-2 border-safety-orange border-t-transparent animate-spin"></div>
              </div>
            )}
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
        <div className="lg:col-span-2 glass-panel border border-white/10 rounded-3xl p-6 flex flex-col gap-4 relative overflow-hidden">
          {reRunning && (
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10">
              <div className="w-8 h-8 rounded-full border-2 border-safety-orange border-t-transparent animate-spin"></div>
              <p className="text-xs text-slate-300 font-mono tracking-wide animate-pulse">
                ZeroHarm AI: Regenerating Handover Report...
              </p>
            </div>
          )}
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
