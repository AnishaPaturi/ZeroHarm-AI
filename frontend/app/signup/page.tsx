'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '../../services/auth';
import { useNotifications } from '../../hooks/useNotifications';
import { 
  Shield, 
  Mail, 
  User, 
  Phone, 
  Building, 
  MapPin, 
  Briefcase, 
  Award, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  FileCheck,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const { addToast } = useNotifications();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [mobile, setMobile] = useState('');
  const [govId, setGovId] = useState('');

  const [companyName, setCompanyName] = useState('ZeroHarm Industrial Corp');
  const [plantLocation, setPlantLocation] = useState('Coke Oven Battery 1');
  const [department, setDepartment] = useState('Safety');
  const [designation, setDesignation] = useState('Safety Officer');
  const [reportingManagerName, setReportingManagerName] = useState('');
  const [reportingManagerEmail, setReportingManagerEmail] = useState('');

  const [certNumber, setCertNumber] = useState('');
  const [certAuthority, setCertAuthority] = useState('');
  const [certExpiry, setCertExpiry] = useState('');
  const [certFile, setCertFile] = useState<File | null>(null);

  const [requestedScopes, setRequestedScopes] = useState<string[]>(['view']);

  const handleScopeChange = (scope: string) => {
    if (requestedScopes.includes(scope)) {
      if (scope !== 'view') { // View-only is mandatory
        setRequestedScopes(requestedScopes.filter(s => s !== scope));
      }
    } else {
      setRequestedScopes([...requestedScopes, scope]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCertFile(e.target.files[0]);
      addToast(`Certificate "${e.target.files[0].name}" loaded.`, 'success');
    }
  };

  // Real-time email validation
  const validateEmailDomain = (emailStr: string) => {
    const publicDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com', 'zoho.com'];
    const domain = emailStr.split('@')[-1] || '';
    return !publicDomains.includes(domain.toLowerCase().trim());
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!fullName || !email || !employeeId || !mobile) {
        addToast('Please fill all required identity fields', 'error');
        return;
      }
      const atIndex = email.indexOf('@');
      if (atIndex === -1) {
        addToast('Please enter a valid email address', 'error');
        return;
      }
      const domain = email.slice(atIndex + 1).toLowerCase().trim();
      const publicDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com', 'zoho.com'];
      if (publicDomains.includes(domain)) {
        addToast('Public email domains are not allowed. Please use your official corporate email.', 'error');
        setErrorMsg('Public domains (Gmail, Yahoo, etc.) are restricted. Corporate SSO domain required.');
        return;
      }
      setErrorMsg(null);
    } else if (step === 2) {
      if (!companyName || !plantLocation || !department || !designation || !reportingManagerName || !reportingManagerEmail) {
        addToast('Please fill all organizational context details', 'error');
        return;
      }
      if (!reportingManagerEmail.includes('@')) {
        addToast('Please enter a valid manager email address', 'error');
        return;
      }
    }
    setStep(step + 1);
  };

  const handlePrevStep = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    const payload = {
      fullName,
      email,
      employeeId,
      mobile,
      govId: govId || undefined,
      companyName,
      plantLocation,
      department,
      designation,
      reportingManagerName,
      reportingManagerEmail,
      certNumber: certNumber || undefined,
      certAuthority: certAuthority || undefined,
      certExpiry: certExpiry || undefined,
      certFileName: certFile ? certFile.name : undefined,
      requestedScopes
    };

    try {
      await authService.signup(payload);
      addToast('Onboarding request submitted successfully!', 'success');
      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed. Please try again.');
      addToast(err.message || 'Failed to submit registration', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8 bg-brand-navy/20">
      <div className="max-w-xl w-full">
        {/* Step progress bar */}
        {!success && (
          <div className="mb-8 px-4">
            <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-2">
              <span className={step >= 1 ? 'text-safety-orange font-bold' : ''}>1. IDENTITY</span>
              <span className={step >= 2 ? 'text-safety-orange font-bold' : ''}>2. CONTEXT</span>
              <span className={step >= 3 ? 'text-safety-orange font-bold' : ''}>3. TRUST SCOPE</span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5">
              <div 
                className="bg-gradient-to-r from-safety-orange to-amber-500 h-full transition-all duration-300"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl text-center relative overflow-hidden"
            >
              <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-9 h-9 text-emerald-400" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-white tracking-tight">
                Request Registered
              </h2>
              <p className="text-sm text-slate-300 mt-4 leading-relaxed max-w-md mx-auto">
                Your onboarding request has been successfully created. We have notified your manager <strong>{reportingManagerName}</strong> ({reportingManagerEmail}) to sponsor your organizational role.
              </p>

              <div className="my-6 p-4 rounded-xl bg-white/5 border border-white/5 text-left text-xs text-slate-400 font-mono space-y-2">
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>EMPLOYEE ID:</span>
                  <span className="text-slate-200">{employeeId}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>VERIFICATION METHOD:</span>
                  <span className="text-slate-200">Sponsorship + Certificate Audit</span>
                </div>
                <div className="flex justify-between">
                  <span>STATUS:</span>
                  <span className="text-amber-400 animate-pulse font-bold">AWAITING ADMIN APPROVAL</span>
                </div>
              </div>

              <div className="text-xs text-slate-400 mb-8 leading-relaxed">
                Once an HSE Admin or Plant Manager approves your application via the <strong>Gatehouse Onboarding Queue</strong>, you will be granted access using your corporate email: <strong>{email}</strong>.
              </div>

              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-all border border-white/10"
              >
                Return to Gateway
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          ) : (
            <motion.form
              key={`step-${step}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleSubmit}
              className="glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden"
            >
              {/* Decorative light */}
              <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-safety-orange/10 blur-3xl pointer-events-none" />

              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-safety-orange" />
                  <h2 className="font-heading text-xl font-bold text-white tracking-tight">
                    Safety Officer Registration
                  </h2>
                </div>
                <span className="text-[10px] text-slate-400 font-mono border border-white/10 px-2 py-0.5 rounded-full">
                  STEP {step} OF 3
                </span>
              </div>

              {errorMsg && (
                <div className="mb-6 flex gap-2.5 items-start p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-mono text-red-300">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Validation Error:</span> {errorMsg}
                  </div>
                </div>
              )}

              {/* STEP 1: IDENTITY */}
              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Please provide your personnel details. Public domains (Gmail, Yahoo, etc.) are automatically blocked.
                  </p>

                  <div>
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block mb-1.5">
                      Full Legal Name <span className="text-safety-orange">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-black/35 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange/40 transition-all font-sans"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block mb-1.5">
                      Official Corporate Email <span className="text-safety-orange">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-black/35 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange/40 transition-all font-mono"
                        placeholder="j.doe@steelcorp.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block mb-1.5">
                        Employee / Personnel ID <span className="text-safety-orange">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        className="w-full bg-black/35 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange/40 transition-all font-mono"
                        placeholder="EMP-8839"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block mb-1.5">
                        Mobile Number <span className="text-safety-orange">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                          <Phone className="w-4 h-4" />
                        </span>
                        <input
                          type="tel"
                          required
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value)}
                          className="w-full bg-black/35 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange/40 transition-all font-mono"
                          placeholder="+91 98765 43210"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block mb-1.5">
                      Gov ID (Aadhaar/PAN Card) <span className="text-slate-500">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={govId}
                      onChange={(e) => setGovId(e.target.value)}
                      className="w-full bg-black/35 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange/40 transition-all font-mono"
                      placeholder="12-digit Aadhaar or 10-digit PAN"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: ORGANIZATIONAL CONTEXT */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Help us locate your physical plant deployment and identify who can authorize your permissions.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block mb-1.5">
                        Company Name <span className="text-safety-orange">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                          <Building className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          required
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="w-full bg-black/35 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange/40 transition-all"
                          placeholder="SteelCorp Group"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block mb-1.5">
                        Plant Facility / Zone <span className="text-safety-orange">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                          <MapPin className="w-4 h-4" />
                        </span>
                        <select
                          value={plantLocation}
                          onChange={(e) => setPlantLocation(e.target.value)}
                          className="w-full bg-black/35 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange/40 transition-all appearance-none cursor-pointer"
                        >
                          <option value="Coke Oven Battery 1">Coke Oven Battery 1</option>
                          <option value="Blast Furnace A">Blast Furnace A</option>
                          <option value="Sinter Plant">Sinter Plant</option>
                          <option value="Ammonia Storage Tank">Ammonia Storage Tank</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block mb-1.5">
                        Department <span className="text-safety-orange">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full bg-black/35 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange/40 transition-all"
                        placeholder="HSE Safety Division"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block mb-1.5">
                        Role / Designation <span className="text-safety-orange">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                          <Briefcase className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          required
                          value={designation}
                          onChange={(e) => setDesignation(e.target.value)}
                          className="w-full bg-black/35 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange/40 transition-all"
                          placeholder="Safety Head / Officer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <span className="text-[10px] text-slate-400 font-mono block mb-3 uppercase tracking-wider">
                      Organizational Approver (Reporting Manager)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block mb-1.5">
                          Manager's Name <span className="text-safety-orange">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={reportingManagerName}
                          onChange={(e) => setReportingManagerName(e.target.value)}
                          className="w-full bg-black/35 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange/40 transition-all"
                          placeholder="Sarah Jenkins"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block mb-1.5">
                          Manager's Email <span className="text-safety-orange">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={reportingManagerEmail}
                          onChange={(e) => setReportingManagerEmail(e.target.value)}
                          className="w-full bg-black/35 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange/40 transition-all font-mono"
                          placeholder="safety@zeroharm.ai"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: SAFETY CREDENTIALS & SCOPE */}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Provide statutory certifications to qualify for high-privilege operations and select your requested access scopes.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block mb-1.5">
                        Statutory Certification #
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                          <Award className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          value={certNumber}
                          onChange={(e) => setCertNumber(e.target.value)}
                          className="w-full bg-black/35 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange/40 transition-all font-mono"
                          placeholder="DGMS-SO-2026"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block mb-1.5">
                        Authority & Expiry Date
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={certAuthority}
                          onChange={(e) => setCertAuthority(e.target.value)}
                          className="w-1/2 bg-black/35 border border-white/10 rounded-xl py-3 px-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange transition-all"
                          placeholder="DGMS India"
                        />
                        <input
                          type="date"
                          value={certExpiry}
                          onChange={(e) => setCertExpiry(e.target.value)}
                          className="w-1/2 bg-black/35 border border-white/10 rounded-xl py-3 px-3 text-xs text-slate-200 focus:outline-none focus:border-safety-orange transition-all cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* File Upload MOCK */}
                  <div>
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block mb-1.5">
                      Upload Certificate Copy <span className="text-slate-500">(PDF / Image)</span>
                    </label>
                    <div className="border border-dashed border-white/10 hover:border-safety-orange/50 transition-colors rounded-xl p-4 bg-black/25 flex flex-col items-center justify-center text-center cursor-pointer relative">
                      <input 
                        type="file" 
                        accept=".pdf,image/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <FileCheck className="w-7 h-7 text-slate-500 mb-2" />
                      <span className="text-xs text-slate-300 font-medium">
                        {certFile ? certFile.name : 'Select or drag certificate file'}
                      </span>
                      <span className="text-[9px] text-slate-500 mt-1">
                        Max file size: 5MB
                      </span>
                    </div>
                  </div>

                  {/* Access Scopes */}
                  <div className="pt-2 border-t border-white/5">
                    <span className="text-[10px] text-slate-400 font-mono block mb-2.5 uppercase tracking-wider">
                      Request Module Access Scopes
                    </span>
                    <div className="space-y-2">
                      <label className="flex items-start gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5 cursor-not-allowed">
                        <input 
                          type="checkbox" 
                          checked 
                          disabled
                          className="mt-1 accent-safety-orange cursor-not-allowed" 
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-white">View-Only Dashboard (Audit Logs)</span>
                          <span className="text-[10px] text-slate-400">View real-time telemetry, incidents, and RAG search logs. (Standard)</span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={requestedScopes.includes('permit_approval')}
                          onChange={() => handleScopeChange('permit_approval')}
                          className="mt-1 accent-safety-orange cursor-pointer" 
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-white">Digital Permit Signing Authority</span>
                          <span className="text-[10px] text-slate-400">Allows active signing, suspending, and modification of hot work/confined permits.</span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={requestedScopes.includes('emergency_trigger')}
                          onChange={() => handleScopeChange('emergency_trigger')}
                          className="mt-1 accent-safety-orange cursor-pointer" 
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-white">Emergency Response Trigger Authority</span>
                          <span className="text-[10px] text-slate-400">Critical access level: allows launching manual sirens, initiating plant-wide evacuations.</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-8 flex justify-between gap-3 pt-4 border-t border-white/5">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-sm py-3 px-5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold text-sm py-3 px-5 rounded-xl transition-all text-center"
                  >
                    Cancel
                  </Link>
                )}

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex-1 bg-gradient-to-r from-safety-orange to-amber-600 hover:from-safety-orange hover:to-amber-500 text-white font-semibold text-sm py-3 px-5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Next Details</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-gradient-to-r from-safety-orange to-amber-600 hover:from-safety-orange hover:to-amber-500 disabled:opacity-50 text-white font-semibold text-sm py-3 px-5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting Request...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Registration</span>
                        <Check className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
