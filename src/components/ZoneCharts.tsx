import React from 'react';
import { HISTORICAL_REGIMES } from '../simulation/financialEngine';
import { EconomicNodeState, MonteCarloPoint, SimulationParams, SimulationState } from '../types/finance';

export const NavSparkline: React.FC<{ history: number[]; accent?: string }> = ({
  history,
  accent = '#F59E0B',
}) => {
  const data = history.length >= 2 ? history : [1000, 1000];
  const min = Math.min(...data) * 0.992;
  const max = Math.max(...data) * 1.008;
  const range = Math.max(1, max - min);
  const w = 340;
  const h = 84;

  const pts = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((val - min) / range) * (h - 14) - 7;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const areaPts = `0,${h} ${pts} ${w},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-22 overflow-visible">
      <defs>
        <linearGradient id="navFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill="url(#navFill)" />
      <polyline
        points={pts}
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const CashFlowWaterfallSvg: React.FC<{ state: SimulationState }> = ({ state }) => {
  const maxVal = Math.max(280, state.operatingCashFlow * 1.15);
  const items = [
    { label: 'OCF', val: state.operatingCashFlow, color: '#10B981' },
    { label: 'CapEx', val: -state.capex, color: '#F59E0B' },
    { label: 'Vốn LĐ', val: -state.workingCapitalDrag, color: '#FB923C' },
    {
      label: 'FCF',
      val: state.freeCashFlow,
      color: state.freeCashFlow >= 0 ? '#38BDF8' : '#EF4444',
    },
  ];

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const pct = Math.min(100, (Math.abs(item.val) / maxVal) * 100);
        return (
          <div key={item.label} className="grid grid-cols-[64px_1fr_72px] items-center gap-2.5 text-xs">
            <span className="text-slate-300 font-medium">{item.label}</span>
            <div className="h-3 bg-slate-800/90 rounded-sm overflow-hidden">
              <div
                className="h-full transition-all duration-200"
                style={{ width: `${pct}%`, backgroundColor: item.color }}
              />
            </div>
            <span className="font-mono-tabular text-right text-slate-200">
              {item.val >= 0 ? '+' : ''}
              {item.val.toFixed(1)}M
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const HistoricalCompareSvg: React.FC<{
  selectedRegimeId: SimulationParams['selectedRegimeId'];
  navHistory: number[];
}> = ({ selectedRegimeId, navHistory }) => {
  const regime = HISTORICAL_REGIMES[selectedRegimeId];
  const w = 340;
  const h = 132;
  const minVal = 48;
  const maxVal = 130;

  const toPolyline = (arr: number[]) =>
    arr
      .map((v, i) => {
        const x = 10 + (i / (arr.length - 1)) * (w - 20);
        const y = h - 14 - ((v - minVal) / (maxVal - minVal)) * (h - 24);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  // Normalize current NAV history onto base 100
  const base = navHistory[0] || 1000;
  const sampleStep = Math.max(1, Math.floor(navHistory.length / 12));
  const currentNorm: number[] = [];
  for (let i = 0; i < navHistory.length; i += sampleStep) {
    currentNorm.push((navHistory[i] / base) * 100);
  }
  if (currentNorm.length < 2) currentNorm.push(100);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-34">
      {[60, 80, 100, 120].map((lvl) => {
        const y = h - 14 - ((lvl - minVal) / (maxVal - minVal)) * (h - 24);
        return (
          <g key={lvl}>
            <line
              x1={10}
              y1={y}
              x2={w - 10}
              y2={y}
              stroke="rgba(148,163,184,0.14)"
              strokeDasharray={lvl === 100 ? 'none' : '3 3'}
            />
            <text x={12} y={y - 3} fontSize="9" fill="#64748B" className="font-mono-tabular">
              {lvl}
            </text>
          </g>
        );
      })}
      <polyline
        points={toPolyline(regime.curve)}
        fill="none"
        stroke="#38BDF8"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <polyline
        points={toPolyline(currentNorm)}
        fill="none"
        stroke="#F59E0B"
        strokeWidth="2"
        strokeDasharray="4 2"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const EconomicCausalGraphSvg: React.FC<{
  nodes: EconomicNodeState[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}> = ({ nodes, selectedNodeId, onSelectNode }) => {
  const coords: Record<string, { x: number; y: number; color: string }> = {
    rate: { x: 64, y: 42, color: '#818CF8' },
    liquidity: { x: 276, y: 42, color: '#38BDF8' },
    inflation: { x: 64, y: 118, color: '#F43F5E' },
    credit: { x: 276, y: 118, color: '#FB923C' },
    gdp: { x: 170, y: 80, color: '#10B981' },
    equity: { x: 170, y: 162, color: '#F59E0B' },
  };

  const edges: [string, string, string][] = [
    ['rate', 'liquidity', '-'],
    ['rate', 'inflation', '-'],
    ['liquidity', 'gdp', '+'],
    ['liquidity', 'credit', '-'],
    ['inflation', 'gdp', '-'],
    ['gdp', 'equity', '+'],
    ['credit', 'equity', '-'],
    ['rate', 'gdp', '-'],
  ];

  return (
    <svg viewBox="0 0 340 198" className="w-full h-50 bg-[#080D15] rounded-lg border border-white/10">
      <defs>
        <marker
          id="arrowPos"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#34D399" />
        </marker>
        <marker
          id="arrowNeg"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#F87171" />
        </marker>
      </defs>

      {edges.map(([from, to, sign]) => {
        const a = coords[from];
        const b = coords[to];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const x1 = a.x + ux * 20;
        const y1 = a.y + uy * 20;
        const x2 = b.x - ux * 22;
        const y2 = b.y - uy * 22;
        const isPos = sign === '+';
        return (
          <line
            key={`${from}-${to}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isPos ? 'rgba(52, 211, 153, 0.55)' : 'rgba(248, 113, 113, 0.55)'}
            strokeWidth="1.5"
            strokeDasharray={isPos ? 'none' : '4 3'}
            markerEnd={isPos ? 'url(#arrowPos)' : 'url(#arrowNeg)'}
          />
        );
      })}

      {nodes.map((node) => {
        const pos = coords[node.id];
        if (!pos) return null;
        const isSel = selectedNodeId === node.id;
        const radius = 14 + (node.value / 100) * 6;
        return (
          <g
            key={node.id}
            onClick={() => onSelectNode(node.id)}
            className="cursor-pointer"
          >
            <circle
              cx={pos.x}
              cy={pos.y}
              r={radius}
              fill="#111A29"
              stroke={pos.color}
              strokeWidth={isSel ? 2.5 : 1.5}
            />
            <text
              x={pos.x}
              y={pos.y + 3}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="600"
              fill="#F8FAFC"
              className="font-mono-tabular"
            >
              {node.displayValue}
            </text>
            <text
              x={pos.x}
              y={pos.y + radius + 11}
              textAnchor="middle"
              fontSize="8.5"
              fill="#94A3B8"
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export const MonteCarloFanSvg: React.FC<{
  paths: MonteCarloPoint[];
  stopLossPct: number;
  currentNav: number;
}> = ({ paths, stopLossPct, currentNav }) => {
  const w = 340;
  const h = 136;
  const allVals = paths.flatMap((p) => [p.p10, p.p90]);
  const minVal = Math.min(...allVals) * 0.96;
  const maxVal = Math.max(...allVals) * 1.03;
  const range = Math.max(10, maxVal - minVal);

  const mapX = (i: number) => 12 + (i / Math.max(1, paths.length - 1)) * (w - 24);
  const mapY = (v: number) => h - 16 - ((v - minVal) / range) * (h - 26);

  const p90Pts = paths.map((p, i) => `${mapX(i).toFixed(1)},${mapY(p.p90).toFixed(1)}`);
  const p50Pts = paths.map((p, i) => `${mapX(i).toFixed(1)},${mapY(p.p50).toFixed(1)}`);
  const p10Pts = paths.map((p, i) => `${mapX(i).toFixed(1)},${mapY(p.p10).toFixed(1)}`);
  const fanPoly = [...p90Pts, ...[...p10Pts].reverse()].join(' ');

  const stopFloor = currentNav * (1 - stopLossPct / 100);
  const stopY = mapY(stopFloor);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-36">
      <polygon points={fanPoly} fill="rgba(45, 212, 191, 0.16)" />
      <polyline points={p90Pts.join(' ')} fill="none" stroke="#34D399" strokeWidth="1.4" strokeDasharray="3 3" />
      <polyline points={p50Pts.join(' ')} fill="none" stroke="#2DD4BF" strokeWidth="2.2" />
      <polyline points={p10Pts.join(' ')} fill="none" stroke="#F87171" strokeWidth="1.5" />
      {stopY >= 8 && stopY <= h - 10 && (
        <g>
          <line
            x1={12}
            y1={stopY}
            x2={w - 12}
            y2={stopY}
            stroke="#EF4444"
            strokeWidth="1"
            strokeDasharray="4 2"
          />
          <text x={14} y={stopY - 4} fontSize="8.5" fill="#FCA5A5" className="font-mono-tabular">
            Stop-Loss (-{stopLossPct}%)
          </text>
        </g>
      )}
    </svg>
  );
};
