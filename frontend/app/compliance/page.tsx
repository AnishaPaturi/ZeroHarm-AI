'use client';

import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useIncident, selectCompliancePercentage, selectComplianceChecklist } from '../../hooks/useIncident';
import { useNotifications } from '../../hooks/useNotifications';
import { eventBus } from '../../lib/eventBus';
import { 
  FileCheck, 
  User, 
  Layers,
  Search,
  CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CompliancePage() {
  const { addToast } = useNotifications();
  const complianceRecords = useIncident(state => state.complianceRecords);
  const compliancePercentage = useIncident(selectCompliancePercentage);

  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'OISD' | 'DGMS' | 'Factory Act'>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (complianceRecords.length > 0 && !selectedRecordId) {
      setSelectedRecordId(complianceRecords[0].id);
    }
  }, [complianceRecords, selectedRecordId]);

  const selectedRecord = complianceRecords.find(r => r.id === selectedRecordId) || null;
  const checklist = useIncident(useShallow(selectComplianceChecklist(selectedRecordId || '')));

  const handleToggleCheck = (id: string) => {
    const item = checklist.find(i => i.id === id);
    if (!item || !selectedRecord) return;
    const nextState = !item.checked;

    eventBus.publish({
      type: 'ComplianceChecklistToggled',
      payload: {
        recordId: selectedRecord.id,
        itemId: id,
        checked: nextState
      }
    });

    addToast(nextState ? 'Checklist task verified' : 'Checklist task marked pending', 'info');
  };

  const filteredRecords = complianceRecords.filter(rec => {
    const matchesCategory = categoryFilter === 'ALL' || rec.category === categoryFilter;
    const matchesSearch = rec.standardName.toLowerCase().includes(search.toLowerCase()) ||
                          rec.id.toLowerCase().includes(search.toLowerCase()) ||
                          rec.inspector.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Compliant':
        return 'bg-green-500/10 border-green-500/20 text-green-400';
      case 'Non-Compliant':
        return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'Pending Audit':
      default:
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    }
  };

  return (
    <div className="flex flex-col gap-6 py-4">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">
            COMPLIANCE DESK
          </span>
          <h1 className="font-heading text-2xl font-bold text-white tracking-tight">
            Regulatory Audits Log
          </h1>
        </div>

        <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-xs font-mono">
          <span>Overall Audit Level: </span>
          <span className="font-bold text-green-400">{compliancePercentage}%</span>
        </div>
      </div>

      {/* Grid splits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left: Audit Records Index */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Controls */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search standards or inspectors..."
                className="w-full bg-black/25 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange transition-all font-mono"
              />
            </div>

            <div className="flex gap-2">
              {(['ALL', 'OISD', 'DGMS', 'Factory Act'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`flex-1 py-1.5 rounded-lg border text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-white/10 border-white/10 text-white'
                      : 'bg-transparent border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Audit Standard List */}
          <div className="flex flex-col gap-3">
            {filteredRecords.length === 0 ? (
              <div className="text-slate-400 py-10 text-center text-xs">
                No compliance standards match filters.
              </div>
            ) : (
              filteredRecords.map(rec => (
                <div
                  key={rec.id}
                  onClick={() => setSelectedRecordId(rec.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all text-left ${
                    selectedRecord?.id === rec.id
                      ? 'bg-white/10 border-safety-orange'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <span className="text-[9px] text-slate-500 font-mono">{rec.category} MODULE</span>
                    <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getStatusStyle(rec.status)}`}>
                      {rec.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white truncate">{rec.standardName}</h4>
                  
                  <div className="flex justify-between items-center mt-4 border-t border-white/5 pt-2.5 text-[9px] text-slate-500 font-mono">
                    <span>SCORE: {rec.score > 0 ? `${rec.score}%` : 'N/A'}</span>
                    <span>Audited: {new Date(rec.lastAudited).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

        {/* Right: Checklist Detail Workspace */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {selectedRecord ? (
              <motion.div
                key={selectedRecord.id}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="glass-panel border border-white/10 rounded-3xl p-6 flex flex-col gap-6"
              >
                
                {/* Header */}
                <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-4">
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-widest bg-white/5 border border-white/10 px-2 py-0.5 rounded inline-block">
                      {selectedRecord.category} AUDIT SUITE
                    </span>
                    <h3 className="font-heading text-lg font-bold text-white mt-2 leading-snug">
                      {selectedRecord.standardName}
                    </h3>
                  </div>

                  <span className={`text-[9px] font-bold font-mono border px-3 py-1 rounded-full uppercase bg-black/45 border-white/10 ${getStatusStyle(selectedRecord.status)}`}>
                    {selectedRecord.status}
                  </span>
                </div>

                {/* Audit details grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-black/25 border border-white/5 rounded-2xl p-4 text-xs font-sans">
                  <div>
                    <span className="text-[9px] text-slate-500 font-mono block">SUITE ID</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">{selectedRecord.id.toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-mono block">AUDITOR</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{selectedRecord.inspector}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-mono block">COMPLIANCE SCORE</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">
                      {selectedRecord.score > 0 ? `${selectedRecord.score} / 100` : 'Pending'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-mono block">FINDINGS</span>
                    <span className={`font-semibold mt-0.5 block ${selectedRecord.criticalFindingsCount > 0 ? 'text-red-400 font-bold animate-pulse' : 'text-slate-300'}`}>
                      {selectedRecord.criticalFindingsCount} Issues
                    </span>
                  </div>
                </div>

                {/* Checklist Interface */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-safety-orange" />
                    <span>Audit Checklist Sheets</span>
                  </h4>

                  <div className="flex flex-col gap-3">
                    {checklist.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => handleToggleCheck(item.id)}
                        className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer select-none transition-all ${
                          item.checked 
                            ? 'bg-emerald-950/5 border-emerald-500/10 text-slate-300' 
                            : 'bg-white/[0.01] border-white/5 text-slate-400 hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="mt-0.5">
                          <div className={`w-4.5 h-4.5 rounded border flex items-center justify-center transition-all ${
                            item.checked 
                              ? 'bg-emerald-500 border-emerald-500 text-slate-950' 
                              : 'border-white/20 hover:border-white/40'
                          }`}>
                            {item.checked && <CheckSquare className="w-3.5 h-3.5 text-black" />}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 text-xs">
                          <p className={`leading-relaxed font-sans ${item.checked ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
                            {item.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-white/5 pt-6 flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-mono uppercase">
                    LAST LOG AUDIT CERTIFICATE GENERATED
                  </span>
                  <button
                    onClick={() => addToast('Compliance report document downloaded', 'success')}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Download Form I-A
                  </button>
                </div>

              </motion.div>
            ) : (
              <div className="h-[60vh] border border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Layers className="w-8 h-8 text-slate-600 mb-3" />
                <h3 className="font-heading text-sm font-bold text-slate-400">Select Audit Log</h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Pick an OISD or DGMS standard suite from the left index panel to check items off the audit sheets.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
