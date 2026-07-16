'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { Mail, Building, MapPin, ShieldAlert } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex flex-col gap-6 py-8 animate-pulse">
        <div className="h-10 bg-white/5 rounded-xl w-1/3" />
        <div className="h-48 bg-white/5 rounded-3xl" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center max-w-md mx-auto py-12">
        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-safety-orange mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="font-heading text-lg font-bold text-white mb-2">Gatehouse Verification Required</h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">
          You must log into the platform gateway to view user credentials.
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

  const userInitials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '';

  return (
    <div className="flex flex-col gap-6 py-4 max-w-xl mx-auto">
      <div>
        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">OPERATIONAL PROFILE</span>
        <h1 className="font-heading text-2xl font-bold text-white tracking-tight">User Credentials</h1>
      </div>

      <div className="glass-panel border border-white/10 rounded-3xl p-6 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-accentBlue to-indigo-500 flex items-center justify-center text-white text-xl font-bold font-mono">
            {userInitials}
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold text-white">{user.name}</h3>
            <span className="text-xs text-safety-orange font-mono font-semibold uppercase">{user.role}</span>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/5 pt-6 text-xs text-slate-300">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-slate-500" />
            <span>{user.email || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-3">
            <Building className="w-4 h-4 text-slate-500" />
            <span>{user.department || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-slate-500" />
            <span>{user.plantLocation || 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
