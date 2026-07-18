'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  BrainCircuit, 
  MessageSquare, 
  BarChart3, 
  BookOpen,
  Scan
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export default function Sidebar() {
  const pathname = usePathname();

  // If we are on landing or login, do not show sidebar
  if (pathname === '/' || pathname === '/login') return null;

  const NAV_ITEMS = [
    { label: 'Operations Center', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Digital Twin', path: '/digital-twin', icon: Scan },
    { label: 'Incident Register', path: '/incidents', icon: FileText },
    { label: 'AI Workspace', path: '/analysis', icon: BrainCircuit },
    { label: 'Safety Assistant', path: '/chatbot', icon: MessageSquare },
    { label: 'Data Storytelling', path: '/analytics', icon: BarChart3 },
    { label: 'Compliance Audits', path: '/compliance', icon: BookOpen },
  ];

  return (
    /* Mobile Bottom Floating visionOS Bar */
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
  );
}
