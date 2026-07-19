'use client';

import React, { useState } from 'react';
import { 
  Shield, 
  Bell, 
  AlertTriangle, 
  User, 
  Users,
  LogOut,
  LayoutDashboard, 
  FileText, 
  BrainCircuit, 
  MessageSquare, 
  BarChart3, 
  BookOpen,
  Scan
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { useIncident, selectActiveAlertCount } from '../hooks/useIncident';
import NotificationPanel from './NotificationPanel';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '../lib/utils';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { toasts } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = useIncident(selectActiveAlertCount);
  const pathname = usePathname();
  const router = useRouter();

  const showNavLinks = isAuthenticated && user && pathname !== '/' && pathname !== '/login';

  const NAV_ITEMS = [
    { label: 'Operations', fullLabel: 'Operations Center', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Digital Twin', fullLabel: 'Digital Twin', path: '/digital-twin', icon: Scan },
    { label: 'Incidents', fullLabel: 'Incident Register', path: '/incidents', icon: FileText },
    { label: 'AI Workspace', fullLabel: 'AI Workspace', path: '/analysis', icon: BrainCircuit },
    { label: 'Safety AI', fullLabel: 'Safety Assistant', path: '/chatbot', icon: MessageSquare },
    { label: 'Analytics', fullLabel: 'Data Storytelling', path: '/analytics', icon: BarChart3 },
    { label: 'Compliance', fullLabel: 'Compliance Audits', path: '/compliance', icon: BookOpen },
  ];

  if (user && (user.role === 'Safety Officer' || user.role === 'Plant Manager')) {
    NAV_ITEMS.push({ label: 'Gatehouse', fullLabel: 'Gatehouse Approvals', path: '/admin', icon: Users });
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-[1440px] mx-auto glass-nav rounded-2xl px-6 py-3 flex items-center justify-between border border-white/5 gap-4">
        
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group cursor-pointer flex-shrink-0">
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

        {/* Nav Links (Desktop hovering top bar integrated) */}
        {showNavLinks && (
          <div className="hidden md:flex items-center gap-1 bg-white/[0.03] border border-white/5 rounded-xl p-1.5 backdrop-blur-md flex-shrink-0">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.path);

              return (
                <Link key={item.path} href={item.path} title={item.fullLabel}>
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 lg:px-3.5 rounded-lg cursor-pointer transition-all select-none text-[11px] lg:text-xs font-semibold relative group whitespace-nowrap",
                      isActive
                        ? "bg-white/10 text-white font-semibold shadow-md shadow-black/10 border-b border-safety-orange"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5 flex-shrink-0 transition-transform", isActive ? "scale-110 text-safety-orange" : "group-hover:scale-105")} />
                    <span className="hidden lg:inline">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-4 flex-shrink-0">
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
                  onClick={() => {
                    logout();
                    router.push('/');
                  }}
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
