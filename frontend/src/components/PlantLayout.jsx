import React from 'react';
import { useSafety } from '../context/SafetyContext';

export default function PlantLayout({ selectedZone, onZoneSelect }) {
  const { getZoneStatus, workers, zones } = useSafety();

  // Helper to count workers in a zone
  const getWorkerCountInZone = (zoneId) => {
    return workers.filter((w) => w.zone === zoneId).length;
  };

  return (
    <svg viewBox="0 0 540 320" className="plant-layout-svg">
      <defs>
        <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Blueprint Grid Background */}
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.02)" strokeWidth="1" />
      </pattern>
      <rect width="100%" height="100%" fill="url(#grid)" rx="8" />

      {/* ZONE 1: Coke Oven Battery */}
      <g onClick={() => onZoneSelect('coke-oven')} style={{ cursor: 'pointer' }}>
        <rect
          x="30"
          y="40"
          width="130"
          height="100"
          rx="6"
          className={`plant-zone ${getZoneStatus('coke-oven')} ${selectedZone === 'coke-oven' ? 'selected' : ''}`}
          style={{
            strokeWidth: selectedZone === 'coke-oven' ? 2 : 1.5,
            stroke: selectedZone === 'coke-oven' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.1)',
          }}
        />
        <text x="95" y="90" className="plant-zone-label">COKE OVEN</text>
        <text x="95" y="105" className="plant-zone-label" style={{ fontSize: '8px', fill: 'var(--text-muted)' }}>BATTERY 4</text>
        {/* Worker Count Badge inside zone */}
        {getWorkerCountInZone('coke-oven') > 0 && (
          <g transform="translate(140, 55)">
            <circle r="8" fill="var(--color-primary)" />
            <text y="3" textAnchor="middle" fill="#fff" fontSize="8px" fontWeight="700">
              {getWorkerCountInZone('coke-oven')}
            </text>
          </g>
        )}
      </g>

      {/* ZONE 2: Blast Furnace */}
      <g onClick={() => onZoneSelect('blast-furnace')} style={{ cursor: 'pointer' }}>
        <path
          d="M 190,140 L 190,60 L 220,30 L 260,30 L 290,60 L 290,140 Z"
          className={`plant-zone ${getZoneStatus('blast-furnace')} ${selectedZone === 'blast-furnace' ? 'selected' : ''}`}
          style={{
            strokeWidth: selectedZone === 'blast-furnace' ? 2 : 1.5,
            stroke: selectedZone === 'blast-furnace' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.1)',
          }}
        />
        <text x="240" y="85" className="plant-zone-label">BLAST FURNACE</text>
        <text x="240" y="100" className="plant-zone-label" style={{ fontSize: '8px', fill: 'var(--text-muted)' }}>UNIT 2</text>
        {getWorkerCountInZone('blast-furnace') > 0 && (
          <g transform="translate(275, 45)">
            <circle r="8" fill="var(--color-primary)" />
            <text y="3" textAnchor="middle" fill="#fff" fontSize="8px" fontWeight="700">
              {getWorkerCountInZone('blast-furnace')}
            </text>
          </g>
        )}
      </g>

      {/* ZONE 3: Gas Mixing Station */}
      <g onClick={() => onZoneSelect('gas-mixing')} style={{ cursor: 'pointer' }}>
        <rect
          x="320"
          y="40"
          width="190"
          height="100"
          rx="6"
          className={`plant-zone ${getZoneStatus('gas-mixing')} ${selectedZone === 'gas-mixing' ? 'selected' : ''}`}
          style={{
            strokeWidth: selectedZone === 'gas-mixing' ? 2 : 1.5,
            stroke: selectedZone === 'gas-mixing' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.1)',
          }}
        />
        {/* Visual of cylinders */}
        <circle cx="370" cy="90" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
        <circle cx="460" cy="90" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
        <text x="415" y="90" className="plant-zone-label">GAS STATION</text>
        <text x="415" y="105" className="plant-zone-label" style={{ fontSize: '8px', fill: 'var(--text-muted)' }}>MIXING & STORAGE</text>
        {getWorkerCountInZone('gas-mixing') > 0 && (
          <g transform="translate(490, 55)">
            <circle r="8" fill="var(--color-primary)" />
            <text y="3" textAnchor="middle" fill="#fff" fontSize="8px" fontWeight="700">
              {getWorkerCountInZone('gas-mixing')}
            </text>
          </g>
        )}
      </g>

      {/* ZONE 4: Chemical Storage */}
      <g onClick={() => onZoneSelect('chemical-storage')} style={{ cursor: 'pointer' }}>
        <rect
          x="30"
          y="180"
          width="180"
          height="100"
          rx="6"
          className={`plant-zone ${getZoneStatus('chemical-storage')} ${selectedZone === 'chemical-storage' ? 'selected' : ''}`}
          style={{
            strokeWidth: selectedZone === 'chemical-storage' ? 2 : 1.5,
            stroke: selectedZone === 'chemical-storage' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.1)',
          }}
        />
        <text x="120" y="230" className="plant-zone-label">CHEMICAL STORAGE</text>
        <text x="120" y="245" className="plant-zone-label" style={{ fontSize: '8px', fill: 'var(--text-muted)' }}>HAZMAT LOCKERS</text>
        {getWorkerCountInZone('chemical-storage') > 0 && (
          <g transform="translate(190, 195)">
            <circle r="8" fill="var(--color-primary)" />
            <text y="3" textAnchor="middle" fill="#fff" fontSize="8px" fontWeight="700">
              {getWorkerCountInZone('chemical-storage')}
            </text>
          </g>
        )}
      </g>

      {/* ZONE 5: Control Room */}
      <g onClick={() => onZoneSelect('control-room')} style={{ cursor: 'pointer' }}>
        <rect
          x="240"
          y="180"
          width="270"
          height="100"
          rx="6"
          className={`plant-zone ${getZoneStatus('control-room')} ${selectedZone === 'control-room' ? 'selected' : ''}`}
          style={{
            strokeWidth: selectedZone === 'control-room' ? 2 : 1.5,
            stroke: selectedZone === 'control-room' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.1)',
          }}
        />
        <text x="375" y="230" className="plant-zone-label">MAIN CONTROL ROOM</text>
        <text x="375" y="245" className="plant-zone-label" style={{ fontSize: '8px', fill: 'var(--text-muted)' }}>SAFE MUSTER POINT</text>
        {getWorkerCountInZone('control-room') > 0 && (
          <g transform="translate(490, 195)">
            <circle r="8" fill="var(--color-primary)" />
            <text y="3" textAnchor="middle" fill="#fff" fontSize="8px" fontWeight="700">
              {getWorkerCountInZone('control-room')}
            </text>
          </g>
        )}
      </g>

      {/* Render blinking worker indicators visually */}
      {workers.map((w, index) => {
        if (w.zone === 'control-room') return null; // don't blink in control room

        // approximate coordinates inside each zone for workers
        let coords = { cx: 0, cy: 0 };
        if (w.zone === 'coke-oven') {
          coords = { cx: 60 + (index * 20), cy: 60 + (index * 10) };
        } else if (w.zone === 'blast-furnace') {
          coords = { cx: 220 + (index * 10), cy: 110 - (index * 15) };
        } else if (w.zone === 'gas-mixing') {
          coords = { cx: 350 + (index * 25), cy: 65 + (index * 15) };
        } else if (w.zone === 'chemical-storage') {
          coords = { cx: 60 + (index * 30), cy: 200 + (index * 15) };
        }

        return (
          <g key={w.id} transform={`translate(${coords.cx}, ${coords.cy})`}>
            <circle r="6" fill="var(--color-primary)" opacity="0.3" className="svg-glow-filter">
              <animate attributeName="r" values="4;10;4" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r="4" fill="var(--color-primary)" />
            <text y="-8" textAnchor="middle" fontSize="6px" fill="#fff" fontFamily="var(--font-mono)">
              {w.name.split(' ')[0]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
