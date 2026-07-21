'use client';

import React, { useState,useEffect } from 'react';
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
// import { useIncident, selectActiveAlertCount } from '../hooks/useIncident';
import NotificationPanel from './NotificationPanel';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../services/api';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { toasts } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  // Operations (/dashboard) now uses the feature-card grid instead of the top nav links,
  // so it gets the same minimal brand + bell + avatar bar as the landing page.
  const showNavLinks = isAuthenticated && user && pathname !== '/' && pathname !== '/login' && pathname !== '/dashboard';
  const showOperationsTag = pathname === "/" && !isAuthenticated;

  const NAV_ITEMS = [
    { label: 'Operations', fullLabel: 'Operations Center', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Digital Twin', fullLabel: 'Digital Twin', path: '/digital-twin', icon: Scan },
    { label: 'Incidents', fullLabel: 'Incident Register', path: '/incidents', icon: FileText },
    { label: 'AI Workspace', fullLabel: 'AI Workspace', path: '/analysis', icon: BrainCircuit },
    { label: 'Safety AI', fullLabel: 'Safety Assistant', path: '/chatbot', icon: MessageSquare },
    { label: 'Analytics', fullLabel: 'Data Storytelling', path: '/analytics', icon: BarChart3 },
    { label: 'Compliance', fullLabel: 'Compliance Audits', path: '/compliance', icon: BookOpen },
    { label: 'Handover', fullLabel: 'Shift Handover Summary', path: '/handover', icon: FileText },
  ];

  useEffect(() => {
  fetch(`${API_BASE_URL}/api/notifications`)
    .then((res) => res.json())
    .then((data) => {
      const unread = data.filter(
        (notification: { is_read: number }) => notification.is_read === 0
      ).length;

      setUnreadCount(unread);
    })
    .catch((err) => {
      console.warn("Could not fetch notifications from backend (server offline?):", err.message || err);
    });
}, []);

  if (user && (user.role === 'Safety Officer' || user.role === 'Plant Manager')) {
    NAV_ITEMS.push({ label: 'Gatehouse', fullLabel: 'Gatehouse Approvals', path: '/admin', icon: Users });
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-[1440px] mx-auto glass-nav rounded-2xl px-8 py-3 flex items-center border border-white/5">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group cursor-pointer flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-safety-orange to-amber-500 flex items-center justify-center shadow-lg shadow-safety-orange/20 transition-transform group-hover:scale-105">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-heading font-bold text-lg tracking-wide text-white">
              ZeroHarm<span className="text-safety-orange">.AI</span>
            </span>
            {showOperationsTag && (
            <span className="hidden sm:inline-block text-[10px] text-slate-400 font-mono ml-2 border border-white/10 px-1.5 py-0.5 rounded uppercase">
              Operations Center
            </span>
          )}
          </div>
        </Link>

      {/* Nav Links */}
      <div className="flex-1 flex justify-center pl-6">
        {showNavLinks && (
          <div className="hidden md:flex items-center gap-1 bg-white/[0.03] border border-white/5 rounded-xl p-1.5 backdrop-blur-md">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.path);

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  title={item.fullLabel}
                >
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 lg:px-3.5 rounded-lg cursor-pointer transition-all select-none text-[11px] lg:text-xs font-semibold relative group whitespace-nowrap",
                      isActive
                        ? "bg-white/10 text-white font-semibold shadow-md shadow-black/10 border-b border-safety-orange"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-3.5 h-3.5 flex-shrink-0 transition-transform",
                        isActive
                          ? "scale-110 text-safety-orange"
                          : "group-hover:scale-105"
                      )}
                    />
                    <span className="hidden lg:inline">
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

        {/* Right Actions */}
        <div className="flex justify-end items-center gap-10">
          {isAuthenticated && user ? (
            <>
              {/* Notifications */}
              <div className="relative ml-6">
                <button
                  suppressHydrationWarning
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
              <div className="relative group">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-accentBlue to-indigo-500 flex items-center justify-center text-white text-sm font-bold cursor-pointer">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>

                {/* Hover Card */}
                <div className="absolute right-0 top-12 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 bg-[#131926] border border-white/10 rounded-xl shadow-2xl p-4 z-50">

                  <div className="text-sm font-semibold text-white">
                    {user.name}
                  </div>

                  <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">
                    {user.role}
                  </div>

                  <button
                    onClick={() => {
                      logout();
                      router.push("/");
                    }}
                    className="mt-4 w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg py-2 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>

                </div>

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