import React from 'react';
import { Bot, Eye, EyeOff, History, Pause, Play, Terminal, TrendingUp } from 'lucide-react';
import { formatUsd } from '../simulation/financialEngine';
import { SimulationState, SwarmStatus } from '../types/finance';

interface TopBarProps {
  state: SimulationState;
  isRunning: boolean;
  speed: 1 | 2 | 5;
  zenMode: boolean;
  swarmOpen: boolean;
  swarmTab: 'swarm' | 'analysis' | 'derivatives';
  swarmStatus: SwarmStatus;
  swarmAutopilot: boolean;
  swarmCountdownSec: number;
  traceVisible: boolean;
  historyOpen: boolean;
  onToggleRunning: () => void;
  onCycleSpeed: () => void;
  onToggleZen: () => void;
  onToggleSwarm: () => void;
  onOpenAnalysis: () => void;
  onToggleTrace: () => void;
  onOpenHistory: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  state,
  isRunning,
  speed,
  zenMode,
  swarmOpen,
  swarmTab,
  swarmStatus,
  swarmAutopilot,
  swarmCountdownSec,
  traceVisible,
  historyOpen,
  onToggleRunning,
  onCycleSpeed,
  onToggleZen,
  onToggleSwarm,
  onOpenAnalysis,
  onToggleTrace,
  onOpenHistory,
}) => {
  if (zenMode) {
    return (
      <div className="fixed top-4 right-4 z-30">
        <button
          type="button"
          onClick={onToggleZen}
          className="px-3.5 py-2 rounded-lg bg-[#0D1420]/94 border border-white/15 text-xs font-medium text-slate-200 hover:text-white hover:border-white/30 flex items-center gap-2 shadow-lg whitespace-nowrap shrink-0"
        >
          <Eye className="w-3.5 h-3.5 text-amber-400" />
          Hiện giao diện (H)
        </button>
      </div>
    );
  }

  const tradeColor =
    state.overallTradeAction === 'MUA'
      ? 'text-emerald-400'
      : state.overallTradeAction === 'BÁN'
        ? 'text-rose-400'
        : 'text-amber-300';

  return (
    <header className="fixed top-3 left-4 right-4 z-20 flex items-center justify-between gap-4 px-4 py-2.5 rounded-xl bg-[#0D1420]/94 border border-white/12 shadow-lg">
      {/* Zone 1: Brand Wordmark & Live Capitalization Snapshot */}
      <div className="flex items-center gap-4 min-w-0">
        <span className="text-sm font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          FinWorld 3D
        </span>
        <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400 whitespace-nowrap">
          <span>
            Vốn hóa{' '}
            <strong className="font-mono-tabular text-slate-100">
              {formatUsd(state.capitalUsd)}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            NAV{' '}
            <strong className="font-mono-tabular text-slate-100">{state.nav.toFixed(1)}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            VaR 95%{' '}
            <strong className="font-mono-tabular text-rose-300">-{state.var95Pct}%</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Quyết định:{' '}
            <strong className={`font-semibold ${tradeColor}`}>{state.overallTradeAction}</strong>
          </span>
        </div>
      </div>

      {/* Zone 3: Real Simulation, History, Trace & Swarm Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenHistory}
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
            historyOpen
              ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
              : 'bg-[#162032] hover:bg-[#1E2B42] border-white/10 text-slate-300'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Lịch sử GD</span>
          <span className="font-mono-tabular text-[11px] text-slate-400">
            ({state.decisionLog.length})
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleTrace}
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
            traceVisible
              ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
              : 'bg-[#162032] hover:bg-[#1E2B42] border-white/10 text-slate-300'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Log Trace</span>
        </button>

        <button
          type="button"
          onClick={onOpenAnalysis}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
            swarmOpen && swarmTab === 'analysis'
              ? 'bg-sky-500 border-sky-400 text-slate-950'
              : 'bg-[#162032] hover:bg-[#1E2B42] border-sky-400/40 text-sky-300'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Phân tích
        </button>

        <button
          type="button"
          onClick={onToggleSwarm}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
            swarmOpen && swarmTab === 'swarm'
              ? 'bg-amber-500 border-amber-400 text-slate-950'
              : 'bg-[#162032] hover:bg-[#1E2B42] border-amber-400/40 text-amber-300'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          {swarmStatus === 'deliberating'
            ? 'Swarm đang hội ý...'
            : swarmAutopilot
              ? `Swarm 5s (${swarmCountdownSec}s)`
              : 'Agent Swarm'}
        </button>

        <button
          type="button"
          onClick={onToggleRunning}
          className="px-3 py-1.5 rounded-lg bg-[#162032] hover:bg-[#1E2B42] border border-white/10 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
        >
          {isRunning ? (
            <>
              <Pause className="w-3.5 h-3.5 text-amber-400" />
              Tạm dừng
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              Chạy mô phỏng
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onCycleSpeed}
          title="Tốc độ mô phỏng thời gian thực"
          className="px-2.5 py-1.5 rounded-lg bg-[#162032] hover:bg-[#1E2B42] border border-white/10 font-mono-tabular text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 transition-colors"
        >
          {speed}x
        </button>

        <button
          type="button"
          onClick={onToggleZen}
          className="px-3 py-1.5 rounded-lg bg-[#162032] hover:bg-[#1E2B42] border border-white/10 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ẩn HUD</span>
        </button>
      </div>
    </header>
  );
};
