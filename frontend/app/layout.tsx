'use client';

import React, { useEffect } from 'react';
import '../styles/globals.css';
import Navbar from '../component/Navbar';
import Sidebar from '../component/Sidebar';
import ScenarioConsole from '../component/ScenarioConsole';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { initDecisionEngine } from '../services/decisionEngine';
import { AnimatePresence, motion } from 'framer-motion';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const initializeAuth = useAuth((s) => s.initialize);
  const { toasts, removeToast } = useNotifications();

  useEffect(() => {
    initializeAuth();
    const unsub = initDecisionEngine();
    return () => unsub();
  }, [initializeAuth]);

  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col bg-brand-navy">
        {/* Ambient background spatial lights */}
        <div className="ambient-bg">
          <div className="ambient-glow-1" />
          <div className="ambient-glow-2" />
        </div>

        {/* Global Nav */}
        <Navbar />

        {/* Floating Side Nav */}
        <Sidebar />

        {/* Viewport Workspace */}
        <main className="flex-1 pt-24 px-4 sm:px-6 md:pl-32 md:pr-10 pb-28 md:pb-12 max-w-7xl mx-auto w-full">
          {children}
        </main>

        {/* Operations Scenario Console */}
        <ScenarioConsole />

        {/* Toast Container */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                onClick={() => removeToast(toast.id)}
                className={`p-4 rounded-xl border glass-panel pointer-events-auto cursor-pointer shadow-lg flex items-center justify-between gap-3 text-xs font-medium text-slate-200 border-white/10 ${
                  toast.type === 'success' ? 'border-l-4 border-l-green-500' :
                  toast.type === 'error' ? 'border-l-4 border-l-red-500' :
                  toast.type === 'warning' ? 'border-l-4 border-l-amber-500' :
                  'border-l-4 border-l-blue-500'
                }`}
              >
                <span>{toast.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </body>
    </html>
  );
}
