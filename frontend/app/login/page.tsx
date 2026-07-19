'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { Shield, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error } = useAuth();
  const { addToast } = useNotifications();
  const [email, setEmail] = useState('safety@zeroharm.ai');
  const [password, setPassword] = useState('password');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      addToast('Please enter an email address', 'error');
      return;
    }
    try {
      await login(email, password);
      addToast('Welcome to ZeroHarm AI Operations Center', 'success');
      router.push('/dashboard');
    } catch (err) {
      addToast('Authentication failed', 'error');
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden"
      >
        {/* Glow light */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-safety-orange/10 blur-3xl pointer-events-none" />

        {/* Branding header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-safety-orange to-amber-500 flex items-center justify-center shadow-lg shadow-safety-orange/20 mx-auto mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h2 className="font-heading text-2xl font-bold text-white tracking-tight">
            Security Gateway
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 font-sans leading-relaxed">
            Enter your credentials to connect to the plant telemetry core.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block mb-1.5">
              Refinery Email Address
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
                placeholder="officer@zeroharm.ai"
                suppressHydrationWarning
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block mb-1.5">
              Secure PIN / Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/35 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange/40 transition-all font-mono"
                placeholder="••••••••"
                suppressHydrationWarning
              />
            </div>
          </div>

          {error && (
            <div className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/15 p-2.5 rounded-lg font-mono">
              Error: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-gradient-to-r from-safety-orange to-amber-600 hover:from-safety-orange hover:to-amber-500 disabled:opacity-50 text-white font-semibold text-sm py-3 px-5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 border border-white/5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-safety-orange/50"
            suppressHydrationWarning
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authorizing Session...</span>
              </>
            ) : (
              <>
                <span>Secure Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 text-center text-xs">
          <span className="text-slate-400">New Safety Officer or Manager? </span>
          <Link href="/signup" className="text-safety-orange hover:underline font-semibold">
            Request Gatehouse Access
          </Link>
        </div>

        {/* Demo Hint */}
        <div className="mt-6 border-t border-white/5 pt-4 text-center">
          <span className="text-[10px] text-slate-500 font-mono block">
            DEFAULT DEMO CREDENTIALS:
          </span>
          <code className="text-[10px] text-slate-300 font-mono bg-white/5 border border-white/5 px-2 py-0.5 rounded mt-1.5 inline-block">
            safety@zeroharm.ai
          </code>
        </div>
      </motion.div>
    </div>
  );
}
