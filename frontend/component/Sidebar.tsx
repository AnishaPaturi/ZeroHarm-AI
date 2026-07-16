'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  BrainCircuit, 
  MessageSquare, 
  BarChart3, 
  BookOpen, 
  ChevronRight, 
  ChevronLeft,
  Menu
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(true);

  // If we are on landing or login, do not show sidebar
  if (pathname === '/' || pathname === '/login') return null;

  const NAV_ITEMS = [
    { label: 'Operations Center', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Incident Register', path: '/incidents', icon: FileText },
    { label: 'AI Workspace', path: '/analysis', icon: BrainCircuit },
    { label: 'Safety Assistant', path: '/chatbot', icon: MessageSquare },
    { label: 'Data Storytelling', path: '/analytics', icon: BarChart3 },
    { label: 'Compliance Audits', path: '/compliance', icon: BookOpen },
  ];

  return (
    <>
      {/* Desktop Floating visionOS Sidebar */}
      <motion.div
        className={cn(
          "fixed left-6 top-28 bottom-28 z-40 hidden md:flex flex-col items-center py-6 glass-panel rounded-3xl transition-all duration-300 border border-white/5 shadow-2xl",
          isCollapsed ? "w-20" : "w-64"
        )}
        layout
      >
        {/* Toggle Collapse Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shadow-lg focus:outline-none"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Nav Links */}
        <div className="flex-1 flex flex-col gap-4 w-full px-3 mt-6">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.path);

            return (
              <Link key={item.path} href={item.path}>
                <motion.div
                  className={cn(
                    "flex items-center gap-4 px-3.5 py-3 rounded-2xl cursor-pointer smooth-hover select-none relative group",
                    isActive 
                      ? "bg-white/10 text-white font-medium shadow-md shadow-black/10 border-l-2 border-safety-orange" 
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className={cn("w-5 h-5 flex-shrink-0 transition-transform", isActive ? "scale-110 text-safety-orange" : "group-hover:scale-105")} />
                  
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.span
                        className="text-sm overflow-hidden whitespace-nowrap"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Tooltip on Collapsed Hover */}
                  {isCollapsed && (
                    <div className="absolute left-24 bg-slate-950/90 text-white border border-white/10 text-xs py-1.5 px-3 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-xl whitespace-nowrap z-50">
                      {item.label}
                    </div>
                  )}
                </motion.div>
              </Link>
            );
          })}
        </div>
      </motion.div>

      {/* Mobile Bottom Floating visionOS Bar */}
      <div className="fixed bottom-6 left-6 right-6 z-40 md:hidden flex justify-around items-center py-2.5 px-4 glass-panel rounded-2xl border border-white/5 shadow-xl">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.path);

          return (
            <Link key={item.path} href={item.path} className="flex flex-col items-center">
              <motion.div
                className={cn(
                  "p-2.5 rounded-xl flex items-center justify-center transition-colors",
                  isActive ? "bg-white/15 text-safety-orange" : "text-slate-400"
                )}
                whileTap={{ scale: 0.95 }}
              >
                <Icon className="w-5 h-5" />
              </motion.div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
