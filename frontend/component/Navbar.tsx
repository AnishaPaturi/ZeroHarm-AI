'use client';

import React, { useState } from 'react';
import { Shield, Bell, AlertTriangle, User, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { useIncident, selectActiveAlertCount } from '../hooks/useIncident';
import NotificationPanel from './NotificationPanel';
import Link from 'next/link';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { toasts } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = useIncident(selectActiveAlertCount);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto glass-nav rounded-2xl px-6 py-3 flex items-center justify-between border border-white/5">
        
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-safety-orange to-amber-500 flex items-center justify-center shadow-lg shadow-safety-orange/20 transition-transform group-hover:scale-105">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-heading font-bold text-lg tracking-wide text-white">
              ZeroHarm<span className="text-safety-orange">.AI</span>
            </span>
            <span className="hidden sm:inline-block text-[10px] text-slate-400 font-mono ml-2 border border-white/10 px-1.5 py-0.5 rounded uppercase">
              Operations Center
            </span>
          </div>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          {isAuthenticated && user ? (
            <>
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-safety-orange/50"
                  aria-label="Toggle notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-safety-orange rounded-full text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-3 w-80 sm:w-96 z-50">
                    <NotificationPanel onClose={() => setShowNotifications(false)} />
                  </div>
                )}
              </div>

              {/* Profile Pill */}
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl pl-3 pr-2 py-1.5">
                <div className="text-right hidden md:block">
                  <div className="text-xs font-semibold text-white">{user.name}</div>
                  <div className="text-[9px] text-slate-400 font-mono tracking-wider uppercase">{user.role}</div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-accentBlue to-indigo-500 flex items-center justify-center text-white text-xs font-bold font-mono">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
                <button
                  onClick={logout}
                  className="p-1 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors ml-1"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <Link 
              href="/login"
              className="bg-white/10 hover:bg-white/20 text-white font-medium text-sm px-5 py-2 rounded-xl transition-all border border-white/10 shadow-sm"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
