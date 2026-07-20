'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { fetchBackend } from '../../services/api';
import { FileText, Clock, AlertTriangle, CheckCircle, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';
import Loader from '../../component/Loader';
import MarkdownRenderer from '../../component/MarkdownRenderer';

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
    handover_narrative: `### AI Generated Shift Handover Report (Offline Preview Mode)

**Generation Timestamp:** ${now.toUTCString()}

**Operational Status Overview:**
- **Active Permits:** 1 hot work permit active.
- **Maintenance Status:** 1 equipment unit isolated for servicing.
- **Safety Alerts Logged:** 1 gas flammability anomaly recorded in Coke Oven Battery 1.

#### Active Work Permits
| Permit ID | Type | Zone | Workers |
|---|---|---|---|
| PTW-HW-202 | HOT WORK | Coke Oven Battery 1 | 3 |

#### Lock-Out Tag-Out & Isolations
| Isolated Equipment | Zone | Status |
|---|---|---|
| Coke Oven Battery 1 manifold/machinery | Coke Oven Battery 1 | In Progress |

#### Environmental & Gas Anomaly Log
- Methane flammability in Coke Oven Battery 1: 4.2% LFL (Statutory limit is <4.0%)

#### Risk Classification
- **Coke Oven Battery 1:** Composite Risk **68.5%** (Warning)

#### Preemptive Directives Checklist
- [ ] Halt spark-producing operations in Coke Oven Battery 1 immediately.
- [ ] Confirm secondary escape routes are clear and safety watch is alert.
- [ ] Verify gas sensor telemetry at the battery boundary.

#### Shift Change Safety Advisory Focus
**Factories Act Sec. 36 Compliance Alert**: Direct incoming shift supervisor to re-verify gas levels on all active confined space entries.`
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
    if (!data) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast('Popup blocked! Please allow popups to export the logbook.', 'error');
      return;
    }

    const permitsRows = data.active_permits?.length
      ? data.active_permits.map((p: any) => `
        <tr>
          <td>${p.permit_id}</td>
          <td style="text-transform: uppercase;">${p.permit_type?.replace('_', ' ')}</td>
          <td>${p.zone}</td>
          <td>${p.workers}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="4" style="text-align: center; color: #64748b;">No active work permits at shift boundary.</td></tr>';

    const maintenanceRows = data.ongoing_maintenance?.length
      ? data.ongoing_maintenance.map((m: any) => `
        <tr>
          <td>${m.equipment}</td>
          <td>${m.zone}</td>
          <td>${m.status}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="3" style="text-align: center; color: #64748b;">All machinery operating online. No LOTO tags active.</td></tr>';

    const gasAlertsContent = data.gas_alerts?.length
      ? data.gas_alerts.map((a: string) => `<li style="color: #b91c1c; font-weight: bold; margin-bottom: 4px;">❌ ${a}</li>`).join('')
      : '<li style="color: #15803d; list-style-type: none;">✔️ All gas sensor readings within safe statutory thresholds.</li>';

    const riskZonesContent = data.high_risk_zones?.length
      ? data.high_risk_zones.map((hz: any) => `<li>⚠️ <strong>${hz.zone}</strong>: Composite Risk ${hz.risk_score}% (${hz.risk_level})</li>`).join('')
      : '<li style="list-style-type: none;">✔️ No critical risk zones active. Plant operating within safe parameters.</li>';

    const recommendationsContent = data.recommendations?.length
      ? data.recommendations.map((rec: string) => `<li>[ ] ${rec}</li>`).join('')
      : '<li>[ ] Continue routine safety rounds and monitor SCADA feeds.</li>';

    const formattedNarrative = data.handover_narrative || '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Shift_Handover_Logbook_${new Date(data.timestamp).toISOString().split('T')[0]}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #1e293b;
              padding: 40px;
              margin: 0;
              background-color: #ffffff;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 20px;
              margin-bottom: 25px;
            }
            .header h1 {
              font-size: 22px;
              margin: 0;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .header p {
              font-size: 10px;
              color: #475569;
              margin: 5px 0 0 0;
              font-family: monospace;
              letter-spacing: 0.5px;
            }
            .meta-grid {
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 15px;
              margin-bottom: 25px;
              font-size: 13px;
              background-color: #f8fafc;
              padding: 15px;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
            }
            .meta-item {
              margin-bottom: 4px;
            }
            .meta-item strong {
              color: #0f172a;
            }
            .section-title {
              font-size: 13px;
              font-weight: 700;
              color: #0f172a;
              border-left: 4px solid #f97316;
              padding-left: 8px;
              margin: 25px 0 12px 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 12px;
            }
            table th, table td {
              border: 1px solid #cbd5e1;
              padding: 8px 12px;
              text-align: left;
            }
            table th {
              background-color: #f1f5f9;
              color: #0f172a;
              font-weight: 600;
            }
            ul {
              margin: 0;
              padding-left: 20px;
              font-size: 12px;
              line-height: 1.6;
            }
            li {
              margin-bottom: 6px;
            }
            .narrative-box {
              background-color: #fafafa;
              border: 1px solid #e2e8f0;
              border-left: 4px solid #0f172a;
              padding: 15px;
              font-family: monospace;
              font-size: 12px;
              white-space: pre-wrap;
              line-height: 1.5;
              border-radius: 4px;
              margin-top: 10px;
            }
            .signatures {
              margin-top: 50px;
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 50px;
              page-break-inside: avoid;
            }
            .signature-line {
              border-top: 1px solid #cbd5e1;
              padding-top: 8px;
              text-align: center;
              font-size: 12px;
              font-weight: 500;
              color: #475569;
              margin-top: 40px;
            }
            @media print {
              body {
                padding: 20px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ZeroHarm AI Safety Intelligence Platform</h1>
            <p>STATUTORY SHIFT HANDOVER LOGBOOK (FACTORIES ACT 1948 SEC. 87)</p>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><strong>Generated On:</strong> ${new Date().toLocaleString()}</div>
            <div class="meta-item"><strong>Shift Timestamp:</strong> ${new Date(data.timestamp).toLocaleString()}</div>
            <div class="meta-item"><strong>Facility Location:</strong> Refinery Operations Area</div>
            <div class="meta-item"><strong>Audited Zones:</strong> Coke Oven Battery, Sinter Plant, Ammonia Storage</div>
          </div>

          <div class="section-title">1. Active Work Permits</div>
          <table>
            <thead>
              <tr>
                <th>Permit ID</th>
                <th>Permit Type</th>
                <th>Zone / Sector</th>
                <th>Worker Count</th>
              </tr>
            </thead>
            <tbody>
              ${permitsRows}
            </tbody>
          </table>

          <div class="section-title">2. LOTO Status & Machinery Isolations</div>
          <table>
            <thead>
              <tr>
                <th>Isolated Equipment Segment</th>
                <th>Zone / Sector</th>
                <th>Current Status</th>
              </tr>
            </thead>
            <tbody>
              ${maintenanceRows}
            </tbody>
          </table>

          <div class="section-title">3. Environmental & Gas Telemetry Anomaly Log</div>
          <ul>
            ${gasAlertsContent}
          </ul>

          <div class="section-title">4. Zone Safety Risk Classifications</div>
          <ul>
            ${riskZonesContent}
          </ul>

          <div class="section-title">5. AI Compiled Shift Change Directives</div>
          <ul>
            ${recommendationsContent}
          </ul>

          <div class="section-title">6. Safety RAG Summary & Precedent Analysis</div>
          <div class="narrative-box">${formattedNarrative}</div>

          <div class="signatures">
            <div>
              <div class="signature-line">Outgoing Shift Safety Officer</div>
            </div>
            <div>
              <div class="signature-line">Incoming Shift Safety Officer</div>
            </div>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    addToast('PDF shift logbook layout prepared for printing.', 'success');
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

          <div className="bg-black/25 border border-white/5 p-5 rounded-2xl border-l-4 border-l-safety-orange">
            <MarkdownRenderer content={data?.handover_narrative} />
          </div>
        </div>

      </div>

    </div>
  );
}
