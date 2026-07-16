'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import { useIncident } from '../../hooks/useIncident';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../hooks/useAuth';
import { Incident, IncidentSeverity, IncidentStatus } from '../../types/incident';
import UploadBox from '../../component/UploadBox';
import Modal from '../../component/Modal';
import { eventBus } from '../../lib/eventBus';
import { 
  Plus, 
  Search, 
  FileWarning, 
  Brain, 
  Paperclip,
  Compass,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function IncidentsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { addToast } = useNotifications();
  const incidents = useIncident(state => state.incidents);
  const activeIncident = useIncident(state => state.activeIncident);
  const isLoading = useIncident(state => state.isLoading);
  const selectIncident = useIncident(state => state.selectIncident);
  const submitComment = useIncident(state => state.submitComment);
  const runAIAnalysis = useIncident(state => state.runAIAnalysis);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal / Drawer state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  // Form state
  const [newIncident, setNewIncident] = useState({
    title: '',
    description: '',
    location: '',
    department: 'Plant Operations',
    severity: 'Medium' as IncidentSeverity,
  });
  const [formFiles, setFormFiles] = useState<File[]>([]);

  // Form submit handler - publishes IncidentCreated to the Event Bus
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncident.title || !newIncident.description || !newIncident.location) {
      addToast('Please fill out all mandatory fields', 'error');
      return;
    }

    try {
      const newId = `inc_${Date.now()}`;
      
      eventBus.publish({
        type: 'IncidentCreated',
        payload: {
          id: newId,
          title: newIncident.title,
          description: newIncident.description,
          location: newIncident.location,
          department: newIncident.department,
          severity: newIncident.severity,
          reporterName: user?.name,
          reporterRole: user?.role
        }
      });

      addToast(`Incident #${newId.substring(4)} registered successfully`, 'success');
      setIsReportModalOpen(false);
      
      // Clear form
      setNewIncident({
        title: '',
        description: '',
        location: '',
        department: 'Plant Operations',
        severity: 'Medium',
      });
      setFormFiles([]);

      // Auto-select the newly created incident
      selectIncident(newId);
    } catch (err) {
      addToast('Failed to log incident', 'error');
    }
  };

  const handleResolveIncident = (id: string) => {
    eventBus.publish({
      type: 'IncidentResolved',
      payload: { id }
    });
    addToast('Incident marked resolved in Event Bus', 'success');
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !activeIncident || !user) return;

    try {
      await submitComment(
        activeIncident.id,
        user.name,
        user.role,
        newCommentText
      );
      setNewCommentText('');
      addToast('Investigative comment logged', 'success');
    } catch (err) {
      addToast('Failed to add comment', 'error');
    }
  };

  const handleTriggerAI = async (id: string) => {
    addToast('Transferring incident payload to RAG parser...', 'info');
    await runAIAnalysis(id);
  };

  // Filter logic
  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch = inc.title.toLowerCase().includes(search.toLowerCase()) || 
                          inc.description.toLowerCase().includes(search.toLowerCase()) ||
                          inc.id.toLowerCase().includes(search.toLowerCase());
    const matchesSeverity = severityFilter === 'ALL' || inc.severity === severityFilter;
    const matchesStatus = statusFilter === 'ALL' || inc.status === statusFilter;
    
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getSeverityBadge = (sev: IncidentSeverity) => {
    switch (sev) {
      case 'Critical':
        return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'High':
        return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
      case 'Medium':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'Low':
      default:
        return 'bg-green-500/10 border-green-500/20 text-green-400';
    }
  };

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
          You must log into the platform gateway to view safety incident details.
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
      
      {/* Top action header */}
      <div className="flex justify-between items-center">
        <div>
          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">
            REGISTRATION OFFICE
          </span>
          <h1 className="font-heading text-2xl font-bold text-white tracking-tight">
            Incident Desk
          </h1>
        </div>
        <button
          onClick={() => setIsReportModalOpen(true)}
          className="bg-safety-orange hover:bg-safety-orange/90 text-white font-semibold text-xs px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 border border-white/5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Report Safety Breach</span>
        </button>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Filterable List */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Search and Filters panel */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Title, ID, or Keywords..."
                className="w-full bg-black/25 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange transition-all font-mono"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="w-full bg-black/25 border border-white/10 rounded-xl py-2 px-3 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-safety-orange"
                >
                  <option value="ALL">ALL SEVERITY</option>
                  <option value="Critical">CRITICAL</option>
                  <option value="High">HIGH</option>
                  <option value="Medium">MEDIUM</option>
                  <option value="Low">LOW</option>
                </select>
              </div>

              <div className="flex-1">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-black/25 border border-white/10 rounded-xl py-2 px-3 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-safety-orange"
                >
                  <option value="ALL">ALL STATUSES</option>
                  <option value="Reported">REPORTED</option>
                  <option value="Under Investigation">INVESTIGATING</option>
                  <option value="RCA Complete">RCA COMPLETE</option>
                  <option value="Resolved">RESOLVED</option>
                </select>
              </div>
            </div>
          </div>

          {/* Incident List */}
          <div className="flex flex-col gap-3">
            {isLoading && incidents.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 font-mono">
                Loading incidents database...
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="text-center py-12 bg-white/[0.01] border border-dashed border-white/5 rounded-2xl p-6 text-slate-400">
                No incidents match the active search filters.
              </div>
            ) : (
              filteredIncidents.map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => selectIncident(inc.id)}
                  className={`p-4 rounded-2xl border cursor-pointer text-left transition-all ${
                    activeIncident?.id === inc.id
                      ? 'bg-white/10 border-safety-orange shadow-md'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <span className="text-[10px] text-slate-500 font-mono">{inc.id.toUpperCase()}</span>
                    <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getSeverityBadge(inc.severity)}`}>
                      {inc.severity}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white truncate">{inc.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {inc.description}
                  </p>

                  <div className="flex justify-between items-center mt-4 border-t border-white/5 pt-2.5 text-[9px] text-slate-500 font-mono">
                    <span>{inc.location}</span>
                    <span>{new Date(inc.reportedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Case File Dossier */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {activeIncident ? (
              <motion.div
                key={activeIncident.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-panel border border-white/10 rounded-3xl p-6 relative"
              >
                {/* Dossier Header */}
                <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-4 mb-6">
                  <div>
                    <span className="text-[9px] text-safety-orange font-mono uppercase tracking-widest bg-safety-orange/10 px-2 py-0.5 rounded border border-safety-orange/20">
                      CASE DOSSIER: {activeIncident.id.toUpperCase()}
                    </span>
                    <h2 className="font-heading text-lg font-bold text-white mt-2 leading-snug">
                      {activeIncident.title}
                    </h2>
                  </div>

                  <div className="flex gap-2 items-center">
                    {activeIncident.status !== ('Resolved' as IncidentStatus) && (
                      <button
                        onClick={() => handleResolveIncident(activeIncident.id)}
                        className="text-[9px] font-bold font-mono bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded-full uppercase transition-colors cursor-pointer"
                      >
                        Resolve Case
                      </button>
                    )}
                    <span className={`text-[9px] font-bold font-mono border px-3 py-1.5 rounded-full uppercase bg-black/45 border-white/10 ${
                      activeIncident.status === 'Resolved' ? 'text-green-400' : activeIncident.status === 'RCA Complete' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {activeIncident.status}
                    </span>
                  </div>
                </div>

                {/* Case File Metadata Tabs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-black/25 border border-white/5 rounded-2xl p-4 mb-6 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-500 font-mono block">LOCATION</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">{activeIncident.location}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-mono block">DEPARTMENT</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">{activeIncident.department}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-mono block">REPORTED AT</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">
                      {new Date(activeIncident.reportedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-mono block">SECTORS</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">Active</span>
                  </div>
                </div>

                {/* Case Description */}
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider mb-2">
                    Case Narrative
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed bg-white/[0.01] border border-white/5 rounded-xl p-3.5">
                    {activeIncident.description}
                  </p>
                </div>

                {/* Uploaded Evidence Attachments */}
                {activeIncident.mediaUrls && activeIncident.mediaUrls.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider mb-2">
                      Evidence Locker
                    </h3>
                    <div className="flex gap-2.5 overflow-x-auto pb-2">
                      {activeIncident.mediaUrls.map((media, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-300">
                          <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono text-[10px]">{media}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* RAG Diagnostics Section */}
                <div className="border-t border-white/5 pt-6 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider">
                      RAG Regulatory Audit
                    </h3>
                    {!activeIncident.aiAnalysis && (
                      <button
                        onClick={() => handleTriggerAI(activeIncident.id)}
                        className="bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold text-[10px] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Brain className="w-3.5 h-3.5 text-safety-orange" />
                        <span>Perform AI Diagnostics</span>
                      </button>
                    )}
                  </div>

                  {activeIncident.aiAnalysis ? (
                    <div className="bg-emerald-950/5 border border-emerald-500/10 rounded-2xl p-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">RAG COMPLIANCE LOGS AUDITED</span>
                        <span className="text-[10px] text-slate-400 font-mono">CONFIDENCE: {activeIncident.aiAnalysis.confidenceScore}%</span>
                      </div>
                      <div className="flex flex-col gap-2.5 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-mono block">VIOLATED CODES:</span>
                          <div className="flex flex-col gap-1.5 mt-1.5">
                            {activeIncident.aiAnalysis.violatedRegulations.map((reg, idx) => (
                              <div key={idx} className="bg-black/25 p-2.5 rounded-lg border border-white/5">
                                <span className="text-[10px] text-safety-orange font-mono font-bold block">{reg.regulation} ({reg.act})</span>
                                <span className="text-[11px] text-slate-300 mt-1 block leading-relaxed">{reg.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-black/25 border border-dashed border-white/5 rounded-2xl p-4 text-xs text-slate-500">
                      RAG diagnostics have not been generated for this case file yet.
                    </div>
                  )}
                </div>

                {/* Case Comments / Logs */}
                <div className="border-t border-white/5 pt-6">
                  <h3 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider mb-4">
                    Investigative Log
                  </h3>
                  
                  <div className="flex flex-col gap-3 mb-4 max-h-40 overflow-y-auto">
                    {activeIncident.comments.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No comments reported on this case.</p>
                    ) : (
                      activeIncident.comments.map((c) => (
                        <div key={c.id} className="p-3 bg-white/5 border border-white/5 rounded-xl text-xs text-slate-300">
                          <div className="flex justify-between items-center mb-1 text-[10px] text-slate-400 font-mono">
                            <span className="font-bold">{c.authorName} ({c.authorRole})</span>
                            <span>{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="leading-relaxed">{c.content}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleCommentSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Append notes to case file..."
                      className="flex-1 bg-black/35 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-safety-orange transition-all"
                    />
                    <button
                      type="submit"
                      className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      Log Note
                    </button>
                  </form>
                </div>

              </motion.div>
            ) : (
              <div className="h-[70vh] border border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center p-6 text-slate-500 bg-white/[0.01]">
                <Compass className="w-8 h-8 text-slate-600 mb-3" />
                <h3 className="font-heading text-sm font-bold text-slate-400">No Case File Selected</h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Select a registered safety inquiry from the left desk panel to inspect compliance logs and diagnostic reports.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Slide-out Report Modal */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Register Safety Incident Breach"
      >
        <form onSubmit={handleCreateIncident} className="flex flex-col gap-4 text-xs">
          <div>
            <label className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block mb-1.5">
              Incident Case Title
            </label>
            <input
              type="text"
              required
              value={newIncident.title}
              onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
              placeholder="e.g. Flare Header Leak segment A"
              className="w-full bg-black/35 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-safety-orange transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block mb-1.5">
                Segment Location
              </label>
              <input
                type="text"
                required
                value={newIncident.location}
                onChange={(e) => setNewIncident({ ...newIncident, location: e.target.value })}
                placeholder="e.g. Unloading Bay 3"
                className="w-full bg-black/35 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-safety-orange transition-all"
              />
            </div>
            <div>
              <label className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block mb-1.5">
                Severity Level
              </label>
              <select
                value={newIncident.severity}
                onChange={(e) => setNewIncident({ ...newIncident, severity: e.target.value as IncidentSeverity })}
                className="w-full bg-black/35 border border-white/10 rounded-xl py-3 px-3 text-slate-300 font-mono focus:outline-none focus:border-safety-orange"
              >
                <option value="Low">LOW</option>
                <option value="Medium">MEDIUM</option>
                <option value="High">HIGH</option>
                <option value="Critical">CRITICAL</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block mb-1.5">
              Detailed Case Narrative
            </label>
            <textarea
              required
              rows={4}
              value={newIncident.description}
              onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
              placeholder="Describe variables, active pressure telemetry readings, affected personnel, and immediate responses..."
              className="w-full bg-black/35 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-safety-orange transition-all leading-relaxed"
            />
          </div>

          <div>
            <label className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block mb-1.5">
              Upload Telemetry Logs / Photos
            </label>
            <UploadBox onFileSelect={(files) => setFormFiles(files)} />
          </div>

          <button
            type="submit"
            className="w-full mt-4 bg-gradient-to-r from-safety-orange to-amber-600 hover:from-safety-orange hover:to-amber-500 text-white font-semibold text-sm py-3 px-5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 border border-white/5 cursor-pointer focus:outline-none"
          >
            <span>Register Case File</span>
          </button>
        </form>
      </Modal>

    </div>
  );
}
