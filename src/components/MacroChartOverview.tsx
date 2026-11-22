import React, { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatUsd } from '../simulation/financialEngine';
import { AssetClassId, SimulationState, ZoneId } from '../types/finance';

interface MacroChartOverviewProps {
  state: SimulationState;
  onSelectZone: (zone: ZoneId) => void;
}

type FlowFilter = 'all' | 'tradFi' | 'crypto' | 'safeHaven';

interface OverviewChartPoint {
  label: string;
  isForecast: boolean;
  tradFiFlow?: number;
  cryptoFlow?: number;
  safeHavenFlow?: number;
  historicalCapitalUsd?: number;
  forecastCapitalUsd?: number;
  expectedReturnsNav?: number;
}

interface VarPdfPoint {
  retPct: number;
  tailDensity: number | null;
  bodyDensity: number | null;
  estPnlUsd: number;
}

interface AssetRiskRow {
  id: AssetClassId;
  label: string;
  ticker: string;
  weightPct: number;
  volRisk: number;
  macroRisk: number;
  concLiqRisk: number;
  compositeRisk: number;
  regulationLabel: string;
  targetZone: ZoneId;
}

function clampRiskScore(val: number): number {
  return Math.max(2, Math.min(99, Math.round(val)));
}

function heatCellClass(score: number): string {
  if (score >= 70) {
    return 'bg-rose-500/35 text-rose-100 border-rose-400/45';
  }
  if (score >= 50) {
    return 'bg-amber-500/28 text-amber-100 border-amber-400/40';
  }
  if (score >= 30) {
    return 'bg-sky-500/18 text-sky-100 border-sky-400/30';
  }
  return 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30';
}

function regulationBadgeText(score: number): string {
  if (score >= 70) return 'Cần giảm';
  if (score >= 50) return 'Theo dõi';
  if (score >= 30) return 'Trung bình';
  return 'An toàn';
}

const FLOW_SERIES = [
  {
    key: 'tradFiFlow' as const,
    filter: 'tradFi' as const,
    label: 'Cổ phiếu & Tăng trưởng',
    shortLabel: 'Cổ phiếu',
    color: '#10B981',
    gradId: 'macroGradTradFi',
  },
  {
    key: 'cryptoFlow' as const,
    filter: 'crypto' as const,
    label: 'Coin & Meme Coin',
    shortLabel: 'Crypto',
    color: '#38BDF8',
    gradId: 'macroGradCrypto',
  },
  {
    key: 'safeHavenFlow' as const,
    filter: 'safeHaven' as const,
    label: 'Trú ẩn (Vàng · TP · USD)',
    shortLabel: 'Trú ẩn',
    color: '#F59E0B',
    gradId: 'macroGradSafe',
  },
];

function formatCompactAxisUsd(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${Math.round(val / 1_000)}K`;
  return `$${Math.round(val)}`;
}

export const MacroChartOverview: React.FC<MacroChartOverviewProps> = ({
  state,
  onSelectZone,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState<FlowFilter>('all');
  const [showForecast, setShowForecast] = useState(true);
  const [showExpectedReturns, setShowExpectedReturns] = useState(true);

  const history = state.capitalFlowHistory;
  const latest = history[history.length - 1];
  const prev = history[history.length - 2] ?? latest;

  const deltaTotal = latest && prev ? Number((latest.totalFlow - prev.totalFlow).toFixed(1)) : 0;
  const riskOnSharePct = latest
    ? Math.round(((latest.tradFiFlow + latest.cryptoFlow) / Math.max(1, latest.totalFlow)) * 100)
    : 0;
  const regimeRotation =
    riskOnSharePct >= 62
      ? 'Mở rộng rủi ro (Risk-On)'
      : riskOnSharePct <= 48
        ? 'Phòng thủ trú ẩn (Risk-Off)'
        : 'Luân chuyển cân bằng';

  const {
    chartData,
    currentAnchorLabel,
    forecastEndUsd,
    forecastDeltaPct,
    expectedNavEnd,
    expectedNavDeltaPct,
    capDomain,
    navDomain,
  } = useMemo(() => {
    const histWindow = history.slice(-14);
    const histLen = histWindow.length;
    const anchorLabel = histWindow[histLen - 1]?.label ?? `T+${state.tick}`;
    const baseNav = Math.max(1, state.nav);
    const usdPerNav = state.capitalUsd / baseNav;

    const points: OverviewChartPoint[] = histWindow.map((pt, idx) => {
      const stepsFromEnd = histLen - 1 - idx;
      const navIdx = Math.max(0, state.navHistory.length - 1 - stepsFromEnd);
      const navAtTick = state.navHistory[navIdx] ?? state.nav;
      const capAtTick = Math.round(state.capitalUsd * (navAtTick / baseNav));
      const isLastHist = idx === histLen - 1;

      return {
        label: pt.label,
        isForecast: false,
        tradFiFlow: pt.tradFiFlow,
        cryptoFlow: pt.cryptoFlow,
        safeHavenFlow: pt.safeHavenFlow,
        historicalCapitalUsd: capAtTick,
        forecastCapitalUsd: isLastHist ? Math.round(state.capitalUsd) : undefined,
        expectedReturnsNav: isLastHist ? Number(state.nav.toFixed(2)) : undefined,
      };
    });

    // 10-step capitalization forecast & near-term Expected Returns NAV trajectory driven by simState
    const recentNavs = state.navHistory.slice(-6);
    const momentumPct =
      recentNavs.length >= 2
        ? ((recentNavs[recentNavs.length - 1] - recentNavs[0]) /
            Math.max(1, recentNavs[0]) /
            (recentNavs.length - 1)) *
          100
        : 0;

    const macroStepDriftPct =
      state.expectedReturnPct / 52 +
      momentumPct * 0.35 +
      (state.freeCashFlow > 30 ? 0.04 : state.freeCashFlow < 0 ? -0.08 : 0) -
      (state.geopoliticalRiskIndex > 60 ? (state.geopoliticalRiskIndex - 60) * 0.004 : 0);

    const riskDampening = Math.max(0.45, 1 - state.var95Pct / 80);
    const convictionTilt = (state.convictionScore - 50) * 0.0028;
    const volStepScale = (state.annualVolatilityPct / 100) * Math.sqrt(1 / 52);

    // Near-term Expected Returns rate (compound NAV trajectory over +1..+10 horizon)
    const annualExpectedRate = state.expectedReturnPct / 100;
    const convictionBoost = (state.convictionScore - 50) * 0.0004;
    const netNearTermRate = annualExpectedRate + convictionBoost;

    let lastProjected = Math.round(state.capitalUsd);
    let lastExpectedNav = Number(state.nav.toFixed(2));
    const showAnyForward = showForecast || showExpectedReturns;

    if (showAnyForward) {
      for (let step = 1; step <= 10; step++) {
        const driftFrac =
          (macroStepDriftPct / 100) * riskDampening * step +
          convictionTilt * Math.sqrt(step) * 0.4;
        const volCurve = Math.sin(step * 0.62 + state.tick * 0.25) * volStepScale * 0.16;
        const projected = Math.round(
          Math.max(state.capitalUsd * 0.4, state.capitalUsd * Math.exp(driftFrac + volCurve)),
        );

        // Near-term NAV growth horizon (each step = ~2 weeks forward -> 10 steps ~ 5 months)
        const horizonYears = step / 26;
        const projectedExpectedNav = Number(
          Math.max(
            420,
            state.nav * Math.exp(netNearTermRate * horizonYears),
          ).toFixed(2),
        );

        if (showForecast) lastProjected = projected;
        lastExpectedNav = projectedExpectedNav;

        points.push({
          label: `+${step}`,
          isForecast: true,
          forecastCapitalUsd: showForecast ? projected : undefined,
          expectedReturnsNav: showExpectedReturns ? projectedExpectedNav : undefined,
        });
      }
    } else {
      const horizonYears = 10 / 26;
      lastExpectedNav = Number(
        Math.max(420, state.nav * Math.exp(netNearTermRate * horizonYears)).toFixed(2),
      );
    }

    const capValues = points.flatMap((p) => {
      const vals: number[] = [];
      if (typeof p.historicalCapitalUsd === 'number') vals.push(p.historicalCapitalUsd);
      if (typeof p.forecastCapitalUsd === 'number') vals.push(p.forecastCapitalUsd);
      if (typeof p.expectedReturnsNav === 'number') vals.push(p.expectedReturnsNav * usdPerNav);
      return vals;
    });
    const minCap = capValues.length > 0 ? Math.min(...capValues) : state.capitalUsd * 0.95;
    const maxCap = capValues.length > 0 ? Math.max(...capValues) : state.capitalUsd * 1.05;
    const span = Math.max(state.capitalUsd * 0.025, maxCap - minCap);

    const capMinBound = Math.round(minCap - span * 0.22);
    const capMaxBound = Math.round(maxCap + span * 0.22);

    const deltaPct =
      state.capitalUsd > 0
        ? Number((((lastProjected - state.capitalUsd) / state.capitalUsd) * 100).toFixed(2))
        : 0;
    const navDeltaPct =
      state.nav > 0
        ? Number((((lastExpectedNav - state.nav) / state.nav) * 100).toFixed(2))
        : 0;

    return {
      chartData: points,
      currentAnchorLabel: anchorLabel,
      forecastEndUsd: lastProjected,
      forecastDeltaPct: deltaPct,
      expectedNavEnd: lastExpectedNav,
      expectedNavDeltaPct: navDeltaPct,
      capDomain: [capMinBound, capMaxBound] as [number, number],
      navDomain: [
        Number((capMinBound / Math.max(1, usdPerNav)).toFixed(2)),
        Number((capMaxBound / Math.max(1, usdPerNav)).toFixed(2)),
      ] as [number, number],
    };
  }, [
    history,
    showForecast,
    showExpectedReturns,
    state.annualVolatilityPct,
    state.capitalUsd,
    state.convictionScore,
    state.expectedReturnPct,
    state.freeCashFlow,
    state.geopoliticalRiskIndex,
    state.nav,
    state.navHistory,
    state.tick,
    state.var95Pct,
  ]);

  const visibleSeries =
    filter === 'all' ? FLOW_SERIES : FLOW_SERIES.filter((s) => s.filter === filter);

  const { varPdfData, varLossUsd, cvarLossUsd, pdfMinR, pdfMaxR } = useMemo(() => {
    const varCut = -Math.max(1, state.var95Pct);
    const cvarCut = -Math.max(state.var95Pct * 1.15, state.cvar95Pct);
    const sigmaH = Math.max(1.4, state.var95Pct / 1.645);
    const muH = Number((state.expectedReturnPct * 0.2025).toFixed(2));
    const tailWeight = Math.min(0.28, 0.1 + state.geopoliticalRiskIndex * 0.0014);

    const minR = Number((muH - 3.35 * sigmaH).toFixed(1));
    const maxR = Number((muH + 3.05 * sigmaH).toFixed(1));
    const steps = 46;
    const stepSize = (maxR - minR) / steps;

    const sampleSet = new Set<number>();
    for (let i = 0; i <= steps; i++) {
      sampleSet.add(Number((minR + i * stepSize).toFixed(2)));
    }
    // Include exact VaR 95% and CVaR cutoffs so tail shading meets body seamlessly
    sampleSet.add(Number(varCut.toFixed(2)));
    sampleSet.add(Number(cvarCut.toFixed(2)));

    const sortedX = Array.from(sampleSet).sort((a, b) => a - b);
    const gaussianPdf = (x: number, mean: number, sd: number) => {
      const z = (x - mean) / sd;
      return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
    };

    const rawDensities = sortedX.map((x) => {
      const core = gaussianPdf(x, muH, sigmaH);
      const fatTail = gaussianPdf(x, muH - 0.85 * sigmaH, sigmaH * 1.65);
      return (1 - tailWeight) * core + tailWeight * fatTail;
    });
    const maxRaw = Math.max(...rawDensities, 1e-6);

    const pts: VarPdfPoint[] = sortedX.map((x, idx) => {
      // Scale to readable relative probability density (0 - 100%)
      const scaled = Number(((rawDensities[idx] / maxRaw) * 100).toFixed(2));
      return {
        retPct: x,
        tailDensity: x <= varCut ? scaled : null,
        bodyDensity: x >= varCut ? scaled : null,
        estPnlUsd: Math.round((state.capitalUsd * x) / 100),
      };
    });

    return {
      varPdfData: pts,
      varLossUsd: -Math.round((state.capitalUsd * state.var95Pct) / 100),
      cvarLossUsd: -Math.round((state.capitalUsd * state.cvar95Pct) / 100),
      pdfMinR: minR,
      pdfMaxR: maxR,
    };
  }, [
    state.capitalUsd,
    state.cvar95Pct,
    state.expectedReturnPct,
    state.geopoliticalRiskIndex,
    state.var95Pct,
  ]);

  const { assetRiskRows, highestRiskAsset } = useMemo(() => {
    const volBase: Record<AssetClassId, number> = {
      equity: 38,
      bond: 14,
      commodity: 34,
      coin: 66,
      memeCoin: 84,
      cash: 4,
    };
    const illiqBase: Record<AssetClassId, number> = {
      equity: 10,
      bond: 7,
      commodity: 12,
      coin: 18,
      memeCoin: 30,
      cash: 2,
    };

    const rows: AssetRiskRow[] = state.assetSignals.map((sig) => {
      const volRisk = clampRiskScore(
        volBase[sig.id] +
          Math.abs(sig.tickChangePct) * 6.5 +
          state.annualVolatilityPct * 0.42 +
          state.var95Pct * 0.55 -
          (sig.id === 'cash' ? state.annualVolatilityPct * 0.38 : 0),
      );

      let macroRaw = 20;
      let targetZone: ZoneId = 'center';
      if (sig.id === 'equity') {
        macroRaw =
          state.legalRiskScore * 0.42 +
          state.inflationPct * 4.2 +
          state.geopoliticalRiskIndex * 0.25 +
          (state.freeCashFlow < 20 ? 16 : 0);
        targetZone = state.legalRiskScore >= 55 ? 'lawer1' : 'department1';
      } else if (sig.id === 'bond') {
        macroRaw = state.inflationPct * 7.5 + state.creditSpreadBps / 7.5;
        targetZone = 'department4';
      } else if (sig.id === 'commodity') {
        macroRaw = state.geopoliticalRiskIndex * 0.62 + Math.abs(state.oilShockPct) * 0.85;
        targetZone = 'department2';
      } else if (sig.id === 'coin') {
        macroRaw = state.creditSpreadBps / 5.2 + state.geopoliticalRiskIndex * 0.35 + 14;
        targetZone = 'department5';
      } else if (sig.id === 'memeCoin') {
        macroRaw = state.geopoliticalRiskIndex * 0.5 + state.creditSpreadBps / 4.2 + 22;
        targetZone = 'lawer2';
      } else {
        macroRaw = state.inflationPct * 6.4;
        targetZone = 'center';
      }
      const macroRisk = clampRiskScore(macroRaw);

      const concLiqRisk = clampRiskScore(
        sig.weightPct * 1.15 +
          illiqBase[sig.id] +
          (sig.id === 'cash'
            ? 2
            : state.liquidityRiskScore * 0.28 + state.concentrationRiskScore * 0.22),
      );

      const compositeRisk = clampRiskScore(
        volRisk * 0.4 + macroRisk * 0.35 + concLiqRisk * 0.25,
      );

      return {
        id: sig.id,
        label: sig.label,
        ticker: sig.ticker,
        weightPct: sig.weightPct,
        volRisk,
        macroRisk,
        concLiqRisk,
        compositeRisk,
        regulationLabel: regulationBadgeText(compositeRisk),
        targetZone,
      };
    });

    const sortedByRisk = [...rows].sort((a, b) => b.compositeRisk - a.compositeRisk);
    return {
      assetRiskRows: rows,
      highestRiskAsset: sortedByRisk[0] ?? null,
    };
  }, [
    state.annualVolatilityPct,
    state.assetSignals,
    state.concentrationRiskScore,
    state.creditSpreadBps,
    state.freeCashFlow,
    state.geopoliticalRiskIndex,
    state.inflationPct,
    state.legalRiskScore,
    state.liquidityRiskScore,
    state.oilShockPct,
    state.var95Pct,
  ]);

  return (
    <section
      aria-label="Biểu đồ lưu chuyển dòng vốn, dự báo vốn hóa và phân phối rủi ro VaR"
      className="fixed top-16 right-4 z-20 w-[440px] max-w-[92vw] max-h-[calc(100vh-7.5rem)] rounded-xl border border-white/12 bg-[#0D1420]/95 shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 min-w-0 text-left hover:text-white transition-colors"
        >
          <Globe className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 whitespace-nowrap">
              <span className="font-mono-tabular">TỔNG QUAN VĨ MÔ</span>
              <span aria-hidden="true">·</span>
              <span>Thời gian thực T+{state.tick}</span>
            </div>
            <h2 className="text-sm font-semibold text-white truncate">
              Dòng Vốn, Dự Báo & Phân Phối Rủi Ro VaR
            </h2>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? 'Thu gọn biểu đồ vĩ mô' : 'Mở biểu đồ vĩ mô'}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-3.5 text-xs">
          {/* Top Quantitative Summary: Capital Flow Velocity + 10-Step Capitalization Forecast */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-slate-400">Lưu lượng vốn toàn cầu</div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-lg font-semibold font-mono-tabular text-white">
                  ${latest ? latest.totalFlow.toFixed(1) : '0.0'}B
                </span>
                <span
                  className={`font-mono-tabular text-[11px] font-medium ${
                    deltaTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {deltaTotal >= 0 ? '+' : ''}
                  {deltaTotal.toFixed(1)}B
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400 truncate">{regimeRotation}</div>
            </div>

            <div className="text-right">
              <div className="text-[11px] text-slate-400">Dự báo vốn hóa (+10 bước)</div>
              <div className="mt-0.5 flex items-baseline justify-end gap-1.5">
                <span className="text-lg font-semibold font-mono-tabular text-fuchsia-300">
                  {formatUsd(forecastEndUsd)}
                </span>
                <span
                  className={`font-mono-tabular text-[11px] font-medium ${
                    forecastDeltaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {forecastDeltaPct >= 0 ? '+' : ''}
                  {forecastDeltaPct}%
                </span>
              </div>
              <div className="mt-0.5 font-mono-tabular text-[11px] text-slate-400">
                Hiện tại {formatUsd(state.capitalUsd)}
              </div>
            </div>
          </div>

          {/* Near-Term Expected Returns (NAV Growth) Readout */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-cyan-500/25 bg-cyan-950/20 text-[11px]">
            <div className="min-w-0">
              <div className="text-cyan-200 font-medium truncate">
                Expected Returns (Tăng trưởng NAV)
              </div>
              <div className="text-slate-400 font-mono-tabular">
                Kỳ vọng năm {state.expectedReturnPct >= 0 ? '+' : ''}
                {state.expectedReturnPct}% · NAV hiện tại {state.nav.toFixed(1)}
              </div>
            </div>
            <div className="text-right shrink-0 font-mono-tabular">
              <div className="text-sm font-semibold text-cyan-300">
                NAV {expectedNavEnd.toFixed(1)}
              </div>
              <div
                className={
                  expectedNavDeltaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }
              >
                {expectedNavDeltaPct >= 0 ? '+' : ''}
                {expectedNavDeltaPct}% (+10 kỳ)
              </div>
            </div>
          </div>

          {/* Stream Filters + Forecast & Expected Returns Toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div
              role="tablist"
              aria-label="Lọc dòng vốn toàn cầu"
              className="flex-1 min-w-[200px] grid grid-cols-4 gap-1 p-1 rounded-lg bg-[#080D15] border border-white/8"
            >
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'tradFi', label: 'Cổ phiếu' },
                  { id: 'crypto', label: 'Crypto' },
                  { id: 'safeHaven', label: 'Trú ẩn' },
                ] as const
              ).map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={active}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={`py-1 px-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-[#1A2538] text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowForecast((v) => !v)}
              className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                showForecast
                  ? 'bg-fuchsia-500/18 border-fuchsia-400/45 text-fuchsia-200'
                  : 'bg-[#080D15] border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            >
              Dự báo +10
            </button>

            <button
              type="button"
              onClick={() => setShowExpectedReturns((v) => !v)}
              className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                showExpectedReturns
                  ? 'bg-cyan-500/18 border-cyan-400/45 text-cyan-200'
                  : 'bg-[#080D15] border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            >
              Expected Returns
            </button>
          </div>

          {/* Recharts Real-Time Area Chart + Capitalization Forecast + Expected Returns (NAV) */}
          <div className="w-full h-48 rounded-lg border border-white/8 bg-[#090F18] pt-2.5 pr-1 pb-1 pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
                <defs>
                  {FLOW_SERIES.map((series) => (
                    <linearGradient
                      key={series.gradId}
                      id={series.gradId}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor={series.color} stopOpacity={0.38} />
                      <stop offset="95%" stopColor={series.color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid
                  stroke="rgba(148, 163, 184, 0.1)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={18}
                />
                <YAxis
                  yAxisId="flow"
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `$${val}B`}
                  domain={[0, 'auto']}
                />
                <YAxis
                  yAxisId="cap"
                  orientation="right"
                  tick={{ fill: '#C084FC', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatCompactAxisUsd}
                  domain={capDomain}
                  width={52}
                />
                <YAxis yAxisId="nav" hide domain={navDomain} />
                {(showForecast || showExpectedReturns) && (
                  <ReferenceLine
                    yAxisId="flow"
                    x={currentAnchorLabel}
                    stroke="rgba(232, 121, 249, 0.45)"
                    strokeDasharray="3 3"
                  />
                )}
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B111A',
                    borderColor: 'rgba(255,255,255,0.14)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#F1F5F9',
                    padding: '6px 10px',
                  }}
                  labelStyle={{ color: '#94A3B8', marginBottom: '2px' }}
                  formatter={(value, name) => {
                    const numeric = Number(Array.isArray(value) ? value[0] : (value ?? 0));
                    const labelName = String(name ?? '');
                    if (labelName === 'Expected Returns') {
                      const pctFromNow =
                        state.nav > 0
                          ? (((numeric - state.nav) / state.nav) * 100).toFixed(2)
                          : '0.00';
                      const sign = Number(pctFromNow) >= 0 ? '+' : '';
                      return [`NAV ${numeric.toFixed(2)} (${sign}${pctFromNow}%)`, labelName];
                    }
                    if (
                      labelName === 'Vốn hóa thực tế' ||
                      labelName === 'Dự báo vốn hóa (+10 bước)'
                    ) {
                      return [formatUsd(numeric), labelName];
                    }
                    return [`$${numeric.toFixed(1)}B`, labelName];
                  }}
                />
                {visibleSeries.map((series) => (
                  <Area
                    key={series.key}
                    yAxisId="flow"
                    type="monotone"
                    dataKey={series.key}
                    name={series.label}
                    stackId={filter === 'all' ? 'globalCapital' : undefined}
                    stroke={series.color}
                    strokeWidth={1.6}
                    fill={`url(#${series.gradId})`}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
                <Line
                  yAxisId="cap"
                  type="monotone"
                  dataKey="historicalCapitalUsd"
                  name="Vốn hóa thực tế"
                  stroke="#E2E8F0"
                  strokeWidth={1.8}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {showForecast && (
                  <Line
                    yAxisId="cap"
                    type="monotone"
                    dataKey="forecastCapitalUsd"
                    name="Dự báo vốn hóa (+10 bước)"
                    stroke="#E879F9"
                    strokeWidth={2.2}
                    strokeDasharray="5 3"
                    dot={false}
                    activeDot={{ r: 3.5, fill: '#E879F9', stroke: '#0B111A', strokeWidth: 1.5 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}
                {showExpectedReturns && (
                  <Line
                    yAxisId="nav"
                    type="monotone"
                    dataKey="expectedReturnsNav"
                    name="Expected Returns"
                    stroke="#22D3EE"
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 3.5, fill: '#22D3EE', stroke: '#0B111A', strokeWidth: 1.5 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Chart Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 bg-slate-200" />
              Thực tế
            </span>
            {showForecast && (
              <span className="flex items-center gap-1.5 text-fuchsia-300">
                <span className="inline-block w-3 border-t-2 border-dashed border-fuchsia-400" />
                Dự báo +10
              </span>
            )}
            {showExpectedReturns && (
              <span className="flex items-center gap-1.5 text-cyan-300">
                <span className="inline-block w-3 h-0.5 bg-cyan-400" />
                Expected Returns (NAV)
              </span>
            )}
            <span className="font-mono-tabular">Sharpe {state.sharpeRatio}</span>
          </div>

          {/* 3-Stream Breakdown Readout */}
          <div className="grid grid-cols-3 gap-2">
            {FLOW_SERIES.map((series) => {
              const val = latest ? latest[series.key] : 0;
              const share =
                latest && latest.totalFlow > 0
                  ? Math.round((val / latest.totalFlow) * 100)
                  : 0;
              return (
                <div
                  key={series.key}
                  className="rounded-lg border border-white/8 bg-[#111927] px-2.5 py-2"
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                    <span
                      className="inline-block w-2 h-0.5 shrink-0"
                      style={{ backgroundColor: series.color }}
                    />
                    <span className="truncate">{series.shortLabel}</span>
                  </div>
                  <div className="mt-1 font-mono-tabular font-semibold text-slate-100">
                    ${val.toFixed(1)}B
                  </div>
                  <div className="font-mono-tabular text-[10px] text-slate-400">
                    {share}% tỷ trọng dòng
                  </div>
                </div>
              );
            })}
          </div>

          {/* VaR Probability Density Function (PDF) & Tail Risk Chart */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">
                  Phân Phối Xác Suất VaR (Tail Risk PDF)
                </div>
                <div className="text-[11px] text-slate-400 font-mono-tabular">
                  VaR 95%{' '}
                  <span className="text-rose-400 font-semibold">
                    -{state.var95Pct}% ({formatUsd(varLossUsd)})
                  </span>
                  {' · '}
                  CVaR{' '}
                  <span className="text-orange-300 font-semibold">
                    -{state.cvar95Pct}% ({formatUsd(cvarLossUsd)})
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full h-36 rounded-lg border border-white/8 bg-[#090F18] pt-2 pr-2 pb-1 pl-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={varPdfData} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="varTailGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.08} />
                    </linearGradient>
                    <linearGradient id="varBodyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2DD4BF" stopOpacity={0.36} />
                      <stop offset="95%" stopColor="#2DD4BF" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(148, 163, 184, 0.1)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    type="number"
                    dataKey="retPct"
                    domain={[pdfMinR, pdfMaxR]}
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}%`}
                  />
                  <YAxis
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 105]}
                    tickFormatter={(v) => `${v}`}
                  />
                  <ReferenceLine
                    x={-state.var95Pct}
                    stroke="#F43F5E"
                    strokeDasharray="4 2"
                    strokeWidth={1.5}
                  />
                  <ReferenceLine
                    x={-state.cvar95Pct}
                    stroke="#FB923C"
                    strokeDasharray="2 2"
                    strokeWidth={1.3}
                  />
                  <ReferenceLine x={0} stroke="rgba(148, 163, 184, 0.35)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0B111A',
                      borderColor: 'rgba(255,255,255,0.14)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#F1F5F9',
                      padding: '6px 10px',
                    }}
                    labelStyle={{ color: '#94A3B8', marginBottom: '2px' }}
                    labelFormatter={(label) => {
                      const ret = Number(label);
                      const pnl = Math.round((state.capitalUsd * ret) / 100);
                      const inTail = ret <= -state.var95Pct;
                      return `Biến động ${ret > 0 ? '+' : ''}${ret}% (${pnl >= 0 ? '+' : ''}${formatUsd(pnl)})${inTail ? ' · Rủi ro đuôi 5%' : ''}`;
                    }}
                    formatter={(value, name) => {
                      const v = Number(Array.isArray(value) ? value[0] : (value ?? 0));
                      return [`Mật độ ${v.toFixed(1)}%`, String(name ?? '')];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tailDensity"
                    name="Vùng rủi ro đuôi (Tail 5%)"
                    stroke="#F43F5E"
                    strokeWidth={2}
                    fill="url(#varTailGrad)"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="bodyDensity"
                    name="Phân phối chuẩn (95%)"
                    stroke="#2DD4BF"
                    strokeWidth={1.8}
                    fill="url(#varBodyGrad)"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-400">
              <span className="flex items-center gap-1.5 text-rose-300">
                <span className="inline-block w-2.5 h-2 rounded-xs bg-rose-500/70" />
                Vùng đuôi 5% (≤ -{state.var95Pct}%)
              </span>
              <span className="flex items-center gap-1.5 text-orange-300">
                <span className="inline-block w-3 border-t border-dotted border-orange-400" />
                CVaR -{state.cvar95Pct}%
              </span>
              <span className="flex items-center gap-1.5 text-teal-300">
                <span className="inline-block w-2.5 h-2 rounded-xs bg-teal-400/60" />
                95% An toàn
              </span>
            </div>
          </div>

          {/* Asset Class Risk Heatmap Matrix */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-xs font-semibold text-slate-200 truncate">
                Bản Đồ Nhiệt Rủi Ro Tài Sản (Heatmap)
              </div>
              {highestRiskAsset && (
                <span
                  className={`text-[10.5px] font-mono-tabular shrink-0 ${
                    highestRiskAsset.compositeRisk >= 70
                      ? 'text-rose-300'
                      : highestRiskAsset.compositeRisk >= 50
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                  }`}
                >
                  Đỉnh nóng: {highestRiskAsset.ticker} ({highestRiskAsset.compositeRisk}/100)
                </span>
              )}
            </div>

            <div className="rounded-lg border border-white/8 bg-[#090F18] p-2">
              <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.68fr))_minmax(0,1fr)] gap-1 px-1 pb-1.5 text-[10px] text-slate-400 font-medium">
                <span>Lớp tài sản</span>
                <span className="text-center">Biến động</span>
                <span className="text-center">Vĩ mô</span>
                <span className="text-center">Tập trung</span>
                <span className="text-right">Điều tiết</span>
              </div>

              <div className="space-y-1">
                {assetRiskRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => onSelectZone(row.targetZone)}
                    title={`Mở phân khu điều tiết rủi ro cho ${row.label}`}
                    className="w-full grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.68fr))_minmax(0,1fr)] items-center gap-1 px-1 py-1 rounded-md hover:bg-white/5 text-left transition-colors"
                  >
                    <div className="min-w-0 pr-1">
                      <div className="text-[11px] font-medium text-slate-100 truncate">
                        {row.label}
                      </div>
                      <div className="text-[9.5px] font-mono-tabular text-slate-400 truncate">
                        {row.ticker} · {row.weightPct}%
                      </div>
                    </div>

                    <span
                      className={`py-1 rounded border text-center font-mono-tabular text-[10.5px] font-semibold ${heatCellClass(row.volRisk)}`}
                    >
                      {row.volRisk}
                    </span>
                    <span
                      className={`py-1 rounded border text-center font-mono-tabular text-[10.5px] font-semibold ${heatCellClass(row.macroRisk)}`}
                    >
                      {row.macroRisk}
                    </span>
                    <span
                      className={`py-1 rounded border text-center font-mono-tabular text-[10.5px] font-semibold ${heatCellClass(row.concLiqRisk)}`}
                    >
                      {row.concLiqRisk}
                    </span>

                    <div className="flex items-center justify-end gap-1 pl-1">
                      <span
                        className={`px-1.5 py-1 rounded border font-mono-tabular text-[10px] font-semibold whitespace-nowrap ${heatCellClass(row.compositeRisk)}`}
                      >
                        {row.compositeRisk} · {row.regulationLabel}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
              <span>Thang nhiệt: &lt;30 An toàn · 30–49 Vừa · 50–69 Theo dõi · ≥70 Cao</span>
              <span>Bấm dòng để mở vùng điều tiết</span>
            </div>
          </div>

          {/* Footer Action to Center Decision Citadel */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-400 truncate">
              Tỷ trọng Risk-On{' '}
              <strong className="font-mono-tabular text-slate-200">{riskOnSharePct}%</strong> · CPI{' '}
              <strong className="font-mono-tabular text-slate-200">
                {state.inflationPct.toFixed(1)}%
              </strong>
            </span>
            <button
              type="button"
              onClick={() => onSelectZone('center')}
              className="px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 text-amber-200 font-medium flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
            >
              Điều phối Center
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
