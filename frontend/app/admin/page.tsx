'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { authService } from '../../services/auth';
import { 
  Users, 
  ShieldAlert, 
  Check, 
  X, 
  Loader2, 
  FileText, 
  MapPin, 
  Building, 
  Award,
  Key,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { addToast } = useNotifications();
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningEmail, setActioningEmail] = useState<string | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const data = await authService.getPendingUsers();
      setPendingUsers(data || []);
    } catch (err) {
      console.warn('Backend offline, loading mock pending onboarding registrations:', err);
      addToast('Backend offline. Loaded mock onboarding queue.', 'info');
      setPendingUsers([
        {
          fullName: "Rohan Sharma",
          email: "rohan.sharma@zeroharm.ai",
          employeeId: "EMP-ZHA-492",
          mobile: "+91 98765 43210",
          govId: "Aadhar 8291-xxxx-3918",
          companyName: "ZeroHarm AI",
          department: "Safety Operations",
          plantLocation: "Coke Oven Division Battery A",
          designation: "Associate Safety Engineer",
          reportingManagerName: "Anisha Paturi",
          reportingManagerEmail: "anisha@zeroharm.ai",
          regulatoryCertId: "Factories-Act-Sec87-Ver2026",
          requestedRole: "Safety Officer",
          requestedScopes: ["emergency_trigger", "audit_signoff", "permit_issue"]
        },
        {
          fullName: "Arjun Verma",
          email: "arjun.verma@industrialsteel.co.in",
          employeeId: "EMP-ST-182",
          mobile: "+91 99887 76655",
          govId: "PAN AABPVxxxxR",
          companyName: "Vizag Industrial Steel",
          department: "Blast Furnace Operations",
          plantLocation: "Furnace Area A",
          designation: "Lead Shift Engineer",
          reportingManagerName: "Satish Kumar",
          reportingManagerEmail: "satish.k@industrialsteel.co.in",
          regulatoryCertId: "OISD-STD-105-Ver2025",
          requestedRole: "Safety Officer",
          requestedScopes: ["permit_issue"]
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && (user?.role === 'Safety Officer' || user?.role === 'Plant Manager')) {
      fetchPending();
    }
  }, [isAuthenticated, user]);

  const handleApprove = async (email: string) => {
    setActioningEmail(email);
    try {
      await authService.approveUser(email);
      addToast(`Approved safety access request for ${email}`, 'success');
      // Refresh local list
      setPendingUsers(prev => prev.filter(u => u.email !== email));
    } catch (err: any) {
      console.warn('Backend offline, running local approval simulation:', err);
      addToast(`Simulation: Approved safety access request for ${email}`, 'success');
      // Refresh local list
      setPendingUsers(prev => prev.filter(u => u.email !== email));
    } finally {
      setActioningEmail(null);
    }
  };

  const handleReject = async (email: string) => {
    setActioningEmail(email);
    try {
      await authService.rejectUser(email);
      addToast(`Rejected access request for ${email}`, 'warning');
      setPendingUsers(prev => prev.filter(u => u.email !== email));
    } catch (err: any) {
      console.warn('Backend offline, running local rejection simulation:', err);
      addToast(`Simulation: Rejected access request for ${email}`, 'warning');
      setPendingUsers(prev => prev.filter(u => u.email !== email));
    } finally {
      setActioningEmail(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-safety-orange animate-spin" />
      </div>
    );
  }

  // Access check
  const hasAccess = isAuthenticated && (user?.role === 'Safety Officer' || user?.role === 'Plant Manager');

  if (!hasAccess) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center max-w-md mx-auto py-12">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 shadow-lg shadow-red-500/5">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="font-heading text-lg font-bold text-white mb-2">Gatehouse Clearance Restricted</h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">
          Only certified HSE Safety Officers or Plant Managers hold the corporate authority to sponsor and verify incoming personnel credentials.
        </p>
        <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-[11px] text-slate-400 font-mono text-left w-full space-y-1">
          <div>• Current Status: <span className="text-red-400">{isAuthenticated ? 'Authenticated' : 'Unauthenticated'}</span></div>
          {isAuthenticated && (
            <div>• Current Role: <span className="text-slate-200">{user?.role}</span> (Requires: Safety Officer / Plant Manager)</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full py-6 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] text-safety-orange font-mono uppercase tracking-widest block mb-1">
            STATUTORY SIGNUP CONTROL
          </span>
          <h1 className="font-heading text-2xl font-bold text-white tracking-tight">
            Gatehouse Onboarding & Sponsorship Queue
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Validate external credentials, domain listings, and assign role-based system scopes (Factories Act 1948 Compliance).
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl font-mono text-[11px] text-slate-300">
          <Key className="w-3.5 h-3.5 text-safety-orange" />
          <span>Approver: <strong className="text-white">{user?.name}</strong> ({user?.role})</span>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel border border-white/10 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-safety-orange animate-spin mb-3" />
          <span className="text-xs text-slate-400 font-mono">Loading pending safety registrations...</span>
        </div>
      ) : pendingUsers.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel border border-emerald-500/10 rounded-2xl p-12 text-center flex flex-col items-center justify-center bg-black/25 relative overflow-hidden"
        >
          <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-heading text-base font-bold text-white mb-1.5">No Pending Registrations</h3>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            All safety officers and engineering personnel requests are currently audited and verified. The gatehouse queue is clear.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <AnimatePresence>
              {pendingUsers.map((pUser, index) => {
                const domain = pUser.email.split('@')[1];
                const isTrustedDomain = domain === 'zeroharm.ai' || domain.includes('steel') || domain.includes('plant') || domain.includes('industrial');

                return (
                  <motion.div
                    key={pUser.email}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
                    className="glass-panel border border-white/10 rounded-2xl p-6 bg-black/40 relative overflow-hidden shadow-xl"
                  >
                    {/* Background glow based on requested scope */}
                    {pUser.requestedScopes?.includes('emergency_trigger') && (
                      <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Identity & Corporate Domain validation */}
                      <div className="lg:col-span-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-safety-orange/20 to-amber-500/20 border border-safety-orange/30 flex items-center justify-center text-safety-orange text-sm font-bold font-mono">
                            {pUser.fullName.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white leading-tight">{pUser.fullName}</h3>
                            <span className="text-[10px] text-slate-400 font-mono">{pUser.email}</span>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-slate-300 font-mono bg-white/5 border border-white/5 rounded-xl p-3">
                          <div className="flex justify-between text-[10px] border-b border-white/5 pb-1">
                            <span className="text-slate-500">EMPLOYEE ID:</span>
                            <span className="text-slate-200">{pUser.employeeId}</span>
                          </div>
                          <div className="flex justify-between text-[10px] border-b border-white/5 pb-1">
                            <span className="text-slate-500">MOBILE:</span>
                            <span className="text-slate-200">{pUser.mobile}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500">GOV ID:</span>
                            <span className="text-slate-200">{pUser.govId || 'Not provided'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 mt-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${isTrustedDomain ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          <span className="text-[9px] text-slate-400 font-mono">
                            {isTrustedDomain ? `TRUSTED DOMAIN: @${domain}` : `UNVERIFIED DOMAIN: @${domain}`}
                          </span>
                        </div>
                      </div>

                      {/* Organizational Context & Manager Sponsor */}
                      <div className="lg:col-span-4 space-y-3 border-t lg:border-t-0 lg:border-x border-white/5 lg:px-6 pt-4 lg:pt-0">
                        <span className="text-[9px] text-slate-400 font-mono block uppercase tracking-wider">
                          ORGANIZATIONAL PLACEMENT
                        </span>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-slate-200">
                            <Building className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{pUser.companyName} ({pUser.department})</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-200">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>Facility: <strong className="text-white">{pUser.plantLocation}</strong></span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-200">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>Designation: <strong className="text-white">{pUser.designation}</strong></span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/5">
                          <span className="text-[9px] text-slate-500 font-mono block mb-1">SPONSORING MANAGER</span>
                          <div className="text-[10px] text-slate-300 font-mono">
                            {pUser.reportingManagerName} <span className="text-slate-500">({pUser.reportingManagerEmail})</span>
                          </div>
                        </div>
                      </div>

                      {/* Credentials & Scope Request */}
                      <div className="lg:col-span-4 space-y-4 pt-4 lg:pt-0">
                        <div>
                          <span className="text-[9px] text-slate-400 font-mono block uppercase tracking-wider mb-2">
                            STATUTORY CREDENTIALS
                          </span>
                          {pUser.certNumber ? (
                            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs">
                              <Award className="w-4 h-4 text-safety-orange mt-0.5 flex-shrink-0" />
                              <div className="space-y-0.5 font-mono text-[10px]">
                                <div className="text-slate-200 font-bold">No. {pUser.certNumber}</div>
                                <div className="text-slate-400">Issuer: {pUser.certAuthority || 'Unknown'}</div>
                                {pUser.certExpiry && (
                                  <div className="text-slate-500 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Exp: {pUser.certExpiry}
                                  </div>
                                )}
                                {pUser.certFileName && (
                                  <div className="text-safety-orange underline flex items-center gap-1 cursor-pointer mt-1 font-sans text-[9.5px]">
                                    <FileText className="w-3 h-3" />
                                    {pUser.certFileName}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5 text-[10px] text-slate-400 italic">
                              <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
                              <span>No regulatory certificate supplied. Restricted permissions.</span>
                            </div>
                          )}
                        </div>

                        <div>
                          <span className="text-[9px] text-slate-400 font-mono block uppercase tracking-wider mb-1.5">
                            REQUESTED SCOPES
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {pUser.requestedScopes?.map((scope: string) => (
                              <span 
                                key={scope} 
                                className={`text-[8.5px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
                                  scope === 'emergency_trigger' 
                                    ? 'bg-red-500/10 border border-red-500/20 text-red-400' 
                                    : scope === 'permit_approval'
                                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                                    : 'bg-slate-500/10 border border-slate-500/20 text-slate-300'
                                }`}
                              >
                                {scope.replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Sponsor action buttons */}
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={() => handleApprove(pUser.email)}
                            disabled={actioningEmail !== null}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-semibold text-xs py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/15"
                          >
                            {actioningEmail === pUser.email ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleReject(pUser.email)}
                            disabled={actioningEmail !== null}
                            className="bg-white/5 hover:bg-red-500/20 disabled:opacity-50 text-slate-300 hover:text-red-400 border border-white/10 hover:border-red-500/30 font-semibold text-xs py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {actioningEmail === pUser.email ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
