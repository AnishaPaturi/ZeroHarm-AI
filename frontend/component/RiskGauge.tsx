'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface RiskGaugeProps {
  score: number; // 0 to 100
  title?: string;
  size?: number;
}

export default function RiskGauge({ score, title = 'Safety Index', size = 180 }: RiskGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const radius = 60;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  // We only sweep a semi-circle or 3/4 circle
  const sweepAngle = 270; // 270 degrees sweep
  const arcLength = (sweepAngle / 360) * circumference;
  const strokeDashoffset = arcLength - (animatedScore / 100) * arcLength;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 400);
    return () => clearTimeout(timer);
  }, [score]);

  // Color picker based on score
  const getColor = (s: number) => {
    if (s >= 90) return 'stroke-green-500 shadow-green-500/20'; // Success green
    if (s >= 75) return 'stroke-blue-500 shadow-blue-500/20'; // Info blue
    if (s >= 60) return 'stroke-amber-500 shadow-amber-500/20'; // Warning orange
    return 'stroke-red-500 shadow-red-500/20'; // Danger red
  };

  const getTextColor = (s: number) => {
    if (s >= 90) return 'text-green-400';
    if (s >= 75) return 'text-blue-400';
    if (s >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg 
          width={size} 
          height={size} 
          viewBox="0 0 160 160" 
          className="transform -rotate-225"
        >
          {/* Background Arc */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            className="stroke-slate-800"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - arcLength}
            strokeLinecap="round"
          />

          {/* Foreground Animated Score Arc */}
          <motion.circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            className={getColor(animatedScore)}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            strokeLinecap="round"
          />
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.span 
            className={`font-heading text-4xl font-bold tracking-tight ${getTextColor(animatedScore)}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {animatedScore}%
          </motion.span>
          <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-1">
            {title}
          </span>
        </div>
      </div>

      <div className="text-center mt-2">
        <span className="text-xs text-slate-400 font-medium">
          Status: {score >= 90 ? 'Stable Operations' : score >= 75 ? 'Caution Advisory' : 'Audit Intervention Required'}
        </span>
      </div>
    </div>
  );
}
