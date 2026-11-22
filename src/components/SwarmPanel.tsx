import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Check,
  Clock,
  Layers,
  Minus,
  Play,
  PlugZap,
  RefreshCw,
  RotateCcw,
  Send,
  Shield,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { ZONE_METADATA, formatUsd } from '../simulation/financialEngine';
import {
  ActiveDerivativePosition,
  AnalysisAssetTarget,
  AssetAnalysisResult,
  AssetRiskBreach,
  DerivativeContractProposal,
  DerivativeSwarmResult,
  LlmProviderId,
  ProviderQuotaInfo,
  QuotaSettings,
  SimulationParams,
  SwarmAgentStance,
  SwarmRunResult,
  SwarmStatus,
  TradeAction,
  ZoneId,
} from '../types/finance';

export type SwarmPanelTab = 'swarm' | 'analysis' | 'derivatives';

interface SwarmPanelProps {
  activeTab: SwarmPanelTab;
  onChangeTab: (tab: SwarmPanelTab) => void;
  status: SwarmStatus;
  error: string | null;
  mission: string;
  autopilot: boolean;
  countdownSec: number;
  autoApply: boolean;
  lastRun: SwarmRunResult | null;
  analysisStatus: 'idle' | 'analyzing' | 'error';
  analysisError: string | null;
  analysisResult: AssetAnalysisResult | null;
  onRunAnalysis: (payload: {
    assetTarget: AnalysisAssetTarget;
    horizonMinutes: number;
    query: string;
  }) => void;
  onApplyAnalysisTrade?: (
    assetTarget: AnalysisAssetTarget,
    action: TradeAction,
    summary: string,
  ) => void;
  derivativeStatus: 'idle' | 'proposing' | 'error';
  derivativeError: string | null;
  derivativeResult: DerivativeSwarmResult | null;
  activeDerivatives: ActiveDerivativePosition[];
  currentVar95Pct: number;
  currentCvar95Pct: number;
  currentVolPct: number;
  derivativeVaRReductionPct: number;
  onProposeDerivatives: (payload: {
    instrumentFocus: 'all' | 'options' | 'futures';
    directive: string;
  }) => void;
  onExecuteDerivative: (proposal: DerivativeContractProposal) => void;
  onExecuteAllDerivatives: (proposals: DerivativeContractProposal[]) => void;
  onCloseDerivative: (contractId: string) => void;
  selectedProvider: LlmProviderId;
  selectedModel: string;
  providers: ProviderQuotaInfo[];
  quotaSettings: QuotaSettings;
  testingProvider: boolean;
  testResult: {
    ok: boolean;
    provider: LlmProviderId;
    message: string;
    latencyMs?: number;
  } | null;
  onSelectProvider: (provider: LlmProviderId) => void;
  onSelectModel: (model: string) => void;
  onTestConnection: () => void;
  onUpdateQuota: (patch: {
    dailyLimit?: number;
    minIntervalSec?: number;
    autoFallbackOn429?: boolean;
    resetUsed?: boolean;
  }) => void;
  onChangeMission: (mission: string) => void;
  onToggleAutopilot: () => void;
  onToggleAutoApply: () => void;
  onRunSwarm: (customMission?: string) => void;
  onRunUrgentSwarm: () => void;
  assetRiskBreaches: AssetRiskBreach[];
  onApplyPatch: (patch: Partial<SimulationParams>, summary: string) => void;
  onSelectZone: (zone: ZoneId) => void;
  onClose: () => void;
}

const STANCE_LABEL: Record<SwarmAgentStance, { text: string; colorClass: string }> = {
  bullish: { text: 'Tích cực', colorClass: 'text-emerald-400' },
  neutral: { text: 'Trung lập', colorClass: 'text-sky-300' },
  cautious: { text: 'Thận trọng', colorClass: 'text-amber-300' },
  veto: { text: 'Cảnh báo / Veto', colorClass: 'text-rose-400' },
};

const QUICK_MISSIONS = [
  'Tối ưu phân bổ vốn theo dòng tiền & rủi ro hiện tại',
  'Ứng phó kịch bản xung đột địa chính trị & cú sốc dầu tăng',
  'Thẩm định chéo điều khoản pháp lý hồ sơ và hạn mức đầu tư',
];

const ANALYSIS_TARGETS: Array<{
  id: AnalysisAssetTarget;
  label: string;
  sub: string;
  defaultQuery: string;
}> = [
  {
    id: 'gold',
    label: 'Vàng (XAU)',
    sub: 'Hàng hóa trú ẩn',
    defaultQuery: 'Phân tích Vàng (XAU) trong 15 phút tới tăng hay giảm dưới áp lực lạm phát & địa chính trị?',
  },
  {
    id: 'gold_forex',
    label: 'Vàng Forex',
    sub: 'XAU/USD · DXY',
    defaultQuery: 'Phân tích vàng trong forex (XAU/USD) trong 15 phút tới theo DXY và lãi suất tăng hay giảm?',
  },
  {
    id: 'coin',
    label: 'Coin',
    sub: 'BTC / ETH / SOL',
    defaultQuery: 'Trong vòng 15 phút tới là Coin (BTC/ETH/SOL) tăng hay giảm?',
  },
  {
    id: 'meme_coin',
    label: 'Meme Coin',
    sub: 'PEPE / DOGE / WIF',
    defaultQuery: 'Phân tích Meme Coin (PEPE/DOGE/WIF) trong 10 phút tới tăng tiếp hay đảo chiều giảm?',
  },
  {
    id: 'custom',
    label: 'Tùy chỉnh',
    sub: 'Lệnh tự nhập',
    defaultQuery: 'Phân tích xu hướng tài sản mục tiêu trong 15 phút tới là tăng hay giảm?',
  },
];

const HORIZON_PRESETS = [5, 15, 30, 60];

const DERIVATIVE_DIRECTIVES = [
  'Phòng hộ rủi ro đuôi (Tail Risk) cho tài sản có VaR cao bằng Put Option',
  'Short Futures phòng vệ sụt giảm khi địa chính trị & lãi suất leo thang',
  'Kết hợp Put Option bảo vệ Coin/Meme Coin và Long Futures Vàng trú ẩn',
];

const PROVIDER_SHORT_LABEL: Record<LlmProviderId, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
};

export const SwarmPanel: React.FC<SwarmPanelProps> = ({
  activeTab,
  onChangeTab,
  status,
  error,
  mission,
  autopilot,
  countdownSec,
  autoApply,
  lastRun,
  analysisStatus,
  analysisError,
  analysisResult,
  onRunAnalysis,
  onApplyAnalysisTrade,
  derivativeStatus,
  derivativeError,
  derivativeResult,
  activeDerivatives,
  currentVar95Pct,
  currentCvar95Pct,
  currentVolPct,
  derivativeVaRReductionPct,
  onProposeDerivatives,
  onExecuteDerivative,
  onExecuteAllDerivatives,
  onCloseDerivative,
  selectedProvider,
  selectedModel,
  providers,
  quotaSettings,
  testingProvider,
  testResult,
  onSelectProvider,
  onSelectModel,
  onTestConnection,
  onUpdateQuota,
  onChangeMission,
  onToggleAutopilot,
  onToggleAutoApply,
  onRunSwarm,
  onRunUrgentSwarm,
  assetRiskBreaches,
  onApplyPatch,
  onSelectZone,
  onClose,
}) => {
  const isBusy = status === 'deliberating';
  const isAnalyzing = analysisStatus === 'analyzing';
  const isProposingDerivatives = derivativeStatus === 'proposing';
  const activeInfo = providers.find((p) => p.provider === selectedProvider);
  const [limitDraft, setLimitDraft] = useState<string>(
    String(activeInfo?.dailyLimit ?? 20),
  );

  // Asset Analysis Command local state
  const [assetTarget, setAssetTarget] = useState<AnalysisAssetTarget>('coin');
  const [horizonMinutes, setHorizonMinutes] = useState<number>(15);
  const [analysisQuery, setAnalysisQuery] = useState<string>(
    'Trong vòng 15 phút tới là Coin (BTC/ETH/SOL) tăng hay giảm?',
  );

  // Derivatives Hedging local state
  const [instrumentFocus, setInstrumentFocus] = useState<'all' | 'options' | 'futures'>('all');
  const [derivativeDirective, setDerivativeDirective] = useState<string>(
    'Đề xuất hợp đồng Options & Futures phòng hộ rủi ro đuôi (VaR/CVaR) cho các lớp tài sản rủi ro cao.',
  );

  useEffect(() => {
    if (activeInfo) {
      setLimitDraft(String(activeInfo.dailyLimit));
    }
  }, [activeInfo?.provider, activeInfo?.dailyLimit]);

  const handleSelectAnalysisTarget = (target: AnalysisAssetTarget) => {
    setAssetTarget(target);
    const meta = ANALYSIS_TARGETS.find((t) => t.id === target);
    if (meta) {
      const minutesForTarget = target === 'meme_coin' ? 10 : horizonMinutes;
      if (target === 'meme_coin') setHorizonMinutes(10);
      setAnalysisQuery(
        meta.defaultQuery.replace(/\b\d+\s*phút\b/i, `${minutesForTarget} phút`),
      );
    }
  };

  const handleQueryChange = (val: string) => {
    setAnalysisQuery(val);
    const match = val.match(/(\d{1,4})\s*(?:phút|min|m\b)/i);
    if (match) {
      const parsed = Math.max(1, Math.min(1440, Number(match[1])));
      if (Number.isFinite(parsed)) {
        setHorizonMinutes(parsed);
      }
    }
  };

  const handleSelectHorizon = (mins: number) => {
    const clamped = Math.max(1, Math.min(1440, Math.round(mins) || 15));
    setHorizonMinutes(clamped);
    setAnalysisQuery((prev) =>
      /\d+\s*phút/i.test(prev) ? prev.replace(/\d+\s*phút/i, `${clamped} phút`) : prev,
    );
  };

  const usedToday = activeInfo?.usedToday ?? 0;
  const dailyLimit = activeInfo?.dailyLimit ?? 20;
  const remainingToday = activeInfo?.remainingToday ?? dailyLimit;
  const usagePct = Math.min(100, Math.round((usedToday / Math.max(1, dailyLimit)) * 100));
  const quotaBarColor =
    usagePct >= 95 ? 'bg-rose-500' : usagePct >= 70 ? 'bg-amber-400' : 'bg-emerald-400';

  const commitDailyLimit = () => {
    const parsed = Number(limitDraft);
    if (Number.isFinite(parsed) && parsed >= 2) {
      onUpdateQuota({ dailyLimit: Math.round(parsed) });
    } else if (activeInfo) {
      setLimitDraft(String(activeInfo.dailyLimit));
    }
  };

  const activeTestFeedback =
    testResult && testResult.provider === selectedProvider
      ? testResult
      : activeInfo?.lastMessage
        ? {
            ok: Boolean(activeInfo.lastTestOk),
            provider: selectedProvider,
            message: activeInfo.lastMessage,
            latencyMs: activeInfo.lastLatencyMs,
          }
        : null;

  return (
    <aside
      aria-label="Điều phối Agent Swarm & Lệnh Phân Tích"
      className="fixed top-16 right-4 bottom-24 z-20 w-[440px] max-w-[92vw] rounded-xl border border-white/12 bg-[#0D1420]/96 shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {activeTab === 'analysis' ? (
              <TrendingUp className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            ) : activeTab === 'derivatives' ? (
              <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            ) : (
              <Bot className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
            <span className="font-mono-tabular">
              {activeTab === 'analysis'
                ? 'ASSET ANALYSIS'
                : activeTab === 'derivatives'
                  ? 'DERIVATIVES DESK'
                  : 'AGENT SWARM'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {activeTab === 'analysis'
                ? 'Vàng · Forex · Coin · Meme'
                : activeTab === 'derivatives'
                  ? 'Options & Futures Hedging'
                  : '7 Chuyên gia + Center CIO'}
            </span>
          </div>
          <h2 className="mt-1 text-base font-semibold text-white truncate">
            {activeTab === 'analysis'
              ? 'Lệnh Yêu Cầu Phân Tích (N Phút)'
              : activeTab === 'derivatives'
                ? 'Phòng Hộ Phái Sinh (Options & Futures)'
                : 'Vận Hành Agent Swarm Thực Tế'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng bảng điều phối"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="px-4 pt-2.5 pb-2 border-b border-white/10 grid grid-cols-3 gap-1.5 bg-[#0A1019]">
        <button
          type="button"
          onClick={() => onChangeTab('swarm')}
          className={`px-2 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'swarm'
              ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
              : 'bg-[#101826] border-white/10 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bot className="w-3.5 h-3.5 shrink-0" />
          <span>Swarm</span>
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('analysis')}
          className={`px-2 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'analysis'
              ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
              : 'bg-[#101826] border-white/10 text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          <span>Phân tích</span>
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('derivatives')}
          className={`px-2 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'derivatives'
              ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
              : 'bg-[#101826] border-white/10 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-3.5 h-3.5 shrink-0" />
          <span>Phái sinh</span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scroll p-5 space-y-4 text-sm">
        {/* Urgent Risk Threshold Breach Priority Banner */}
        {assetRiskBreaches.length > 0 && (
          <div className="rounded-lg border border-rose-500/55 bg-rose-950/55 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-rose-200 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                Ưu tiên xử lý gấp ({assetRiskBreaches.length} vượt ngưỡng)
              </span>
              <button
                type="button"
                disabled={isBusy}
                onClick={onRunUrgentSwarm}
                className="px-2.5 py-1 rounded-md bg-rose-500 hover:bg-rose-400 disabled:bg-rose-500/40 text-white font-semibold text-[11px] transition-colors shrink-0"
              >
                {isBusy ? 'Đang xử lý...' : 'Swarm Xử Lý Gấp'}
              </button>
            </div>
            <div className="space-y-1 text-[11px] font-mono-tabular text-rose-100/90">
              {assetRiskBreaches.map((b) => (
                <div key={b.assetId} className="flex items-center justify-between gap-2">
                  <span>
                    {b.label} ({b.ticker}) · {b.triggerMetric}
                  </span>
                  <span>
                    Vol {b.volatilityPct}% / VaR {b.var95Pct}% &gt; Ngưỡng {b.thresholdPct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Multi-Provider, Test Connection & Quota Limit Section */}
        <section
          aria-label="Cấu hình Provider và Quota Limit"
          className="rounded-lg border border-white/10 bg-[#101826] p-3.5 space-y-3"
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>Provider &amp; Quota Limit</span>
            </div>
            {activeInfo && (
              <span
                className={`text-[11px] font-mono-tabular ${
                  activeInfo.configured ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {activeInfo.configured
                  ? `Key sẵn sàng (${activeInfo.envVarName})`
                  : `Chưa có ${activeInfo.envVarName}`}
              </span>
            )}
          </div>

          {/* 4 Provider Selector Grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {providers.map((prov) => {
              const isSelected = prov.provider === selectedProvider;
              const exhausted = prov.remainingToday <= 0;
              return (
                <button
                  key={prov.provider}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onSelectProvider(prov.provider)}
                  className={`px-2.5 py-2 rounded-lg border text-left transition-colors disabled:opacity-60 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400/60 text-white'
                      : 'bg-[#0B111A] border-white/10 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 text-xs font-medium">
                    <span className="flex items-center gap-1.5 truncate">
                      <span
                        className={`w-1.5 h-1.5 rounded-xs shrink-0 ${
                          !prov.configured
                            ? 'bg-slate-500'
                            : exhausted
                              ? 'bg-rose-400'
                              : 'bg-emerald-400'
                        }`}
                      />
                      {PROVIDER_SHORT_LABEL[prov.provider]}
                    </span>
                    <span
                      className={`text-[10.5px] font-mono-tabular ${
                        exhausted ? 'text-rose-400' : 'text-slate-400'
                      }`}
                    >
                      {prov.usedToday}/{prov.dailyLimit}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-400 truncate">
                    {prov.configured ? prov.defaultModel : `Cần ${prov.envVarName}`}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Model Selector + Test Connection */}
          <div className="flex items-center gap-2">
            <select
              aria-label="Chọn Model"
              value={selectedModel}
              disabled={isBusy}
              onChange={(e) => onSelectModel(e.target.value)}
              className="flex-1 min-w-0 rounded-lg border border-white/15 bg-[#080D15] px-2.5 py-1.5 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-amber-400"
            >
              {(activeInfo?.availableModels ?? [selectedModel]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={testingProvider || isBusy}
              onClick={onTestConnection}
              className="px-3 py-1.5 rounded-lg border border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/25 disabled:opacity-50 text-sky-200 text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors"
            >
              {testingProvider ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Đang test...
                </>
              ) : (
                <>
                  <PlugZap className="w-3.5 h-3.5" />
                  Test Connection
                </>
              )}
            </button>
          </div>

          {/* Test Connection Result Feedback */}
          {activeTestFeedback && (
            <div
              className={`rounded-md border px-2.5 py-1.5 text-[11px] leading-snug ${
                activeTestFeedback.ok
                  ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                  : 'border-rose-500/35 bg-rose-500/10 text-rose-200'
              }`}
            >
              {activeTestFeedback.message}
            </div>
          )}

          {/* Quota Limit Progress + Controls */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>
                Quota hôm nay ({PROVIDER_SHORT_LABEL[selectedProvider]})
              </span>
              <span className="font-mono-tabular">
                Đã dùng {usedToday}/{dailyLimit} · Còn {remainingToday} lượt
              </span>
            </div>
            <div className="h-1.5 w-full rounded-xs bg-[#080D15] overflow-hidden border border-white/5">
              <div
                className={`h-full transition-all ${quotaBarColor}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <label htmlFor="quota-daily-limit" className="text-slate-400 shrink-0">
                  Limit/ngày:
                </label>
                <input
                  id="quota-daily-limit"
                  type="number"
                  min={2}
                  max={5000}
                  value={limitDraft}
                  onChange={(e) => setLimitDraft(e.target.value)}
                  onBlur={commitDailyLimit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitDailyLimit();
                  }}
                  className="w-16 rounded border border-white/15 bg-[#080D15] px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  title="Reset bộ đếm Quota hôm nay về 0"
                  onClick={() => onUpdateQuota({ resetUsed: true })}
                  className="px-2 py-1 rounded border border-white/10 bg-[#151F30] hover:bg-white/10 text-slate-300 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>

              <div className="flex items-center justify-end gap-1.5">
                <label htmlFor="quota-cooldown" className="text-slate-400 shrink-0">
                  Cooldown:
                </label>
                <select
                  id="quota-cooldown"
                  value={quotaSettings.minIntervalSec}
                  onChange={(e) =>
                    onUpdateQuota({ minIntervalSec: Number(e.target.value) })
                  }
                  className="rounded border border-white/15 bg-[#080D15] px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-amber-400"
                >
                  <option value={5}>5s</option>
                  <option value={10}>10s</option>
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onUpdateQuota({ autoFallbackOn429: !quotaSettings.autoFallbackOn429 })
              }
              className={`w-full px-2.5 py-1.5 rounded-md border text-[11px] flex items-center justify-between transition-colors ${
                quotaSettings.autoFallbackOn429
                  ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/10 bg-[#0B111A] text-slate-400'
              }`}
            >
              <span>Tự chuyển Provider dự phòng khi gặp 429 / hết Quota</span>
              <span className="font-mono-tabular font-semibold">
                {quotaSettings.autoFallbackOn429 ? 'BẬT' : 'TẮT'}
              </span>
            </button>
          </div>
        </section>

        {activeTab === 'swarm' ? (
          <>
            {/* Mission Input & Launch */}
            <div className="space-y-2.5">
              <label htmlFor="swarm-mission-input" className="block text-xs font-medium text-slate-300">
                Chỉ thị điều phối gửi tới 8 Agent
              </label>
              <textarea
                id="swarm-mission-input"
                rows={2}
                value={mission}
                onChange={(e) => onChangeMission(e.target.value)}
                placeholder="Nhập mục tiêu phân tích hoặc chiến lược cho Swarm..."
                className="w-full rounded-lg border border-white/15 bg-[#080D15] p-2.5 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-amber-400"
              />

              <div className="flex flex-wrap gap-1.5">
                {QUICK_MISSIONS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      onChangeMission(preset);
                      onRunSwarm(preset);
                    }}
                    className="px-2.5 py-1 rounded-md bg-[#141D2D] hover:bg-[#1D2A40] border border-white/10 text-[11px] text-slate-300 text-left transition-colors disabled:opacity-50"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onRunSwarm()}
                  className="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  {isBusy ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Đang hội ý 8 Agent...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Kích hoạt Hội đồng Swarm
                    </>
                  )}
                </button>
              </div>

              {/* Autopilot Schedule & Auto-Apply Toggles */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={onToggleAutopilot}
                  className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                    autopilot
                      ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                      : 'bg-[#111927] border-white/10 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <div className="font-medium">
                    Lịch tự động ({Math.max(5, quotaSettings.minIntervalSec)}s)
                  </div>
                  <div className="font-mono-tabular text-[11px] text-slate-400">
                    {!autopilot
                      ? 'Đang tắt'
                      : isBusy
                        ? 'Đang gọi công cụ & hội ý...'
                        : `Swarm kế tiếp sau ${countdownSec}s`}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={onToggleAutoApply}
                  className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                    autoApply
                      ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                      : 'bg-[#111927] border-white/10 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <div className="font-medium">Tự động thực thi</div>
                  <div className="text-[11px] text-slate-400">
                    {autoApply ? 'Áp dụng vào 3D ngay' : 'Chờ xác nhận tay'}
                  </div>
                </button>
              </div>
            </div>

            {/* Error Display (explicit, never masked) */}
            {error && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Không thể hoàn tất phiên Swarm</div>
                  <div className="mt-0.5 text-rose-200/90">{error}</div>
                </div>
              </div>
            )}

            {/* Orchestrator Consensus Card */}
            {lastRun && (
              <div className="rounded-lg border border-amber-400/30 bg-[#121B2B] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-semibold text-amber-300 truncate">
                    Center CIO: {lastRun.orchestrator.consensusStance}
                  </span>
                  <span className="font-mono-tabular text-slate-400 shrink-0">
                    Đồng thuận {lastRun.orchestrator.confidence}% · {(lastRun.latencyMs / 1000).toFixed(1)}s
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-400">
                  <span>
                    Engine:{' '}
                    <strong className="text-sky-300">
                      {lastRun.provider ? PROVIDER_SHORT_LABEL[lastRun.provider] : 'Gemini'}
                    </strong>{' '}
                    · {lastRun.model}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-md bg-[#0B111A] border border-white/10">
                  <span className="text-slate-300">
                    Lệnh đề xuất:{' '}
                    <strong
                      className={
                        lastRun.orchestrator.tradeDecision === 'MUA'
                          ? 'text-emerald-400'
                          : lastRun.orchestrator.tradeDecision === 'BÁN'
                            ? 'text-rose-400'
                            : 'text-amber-300'
                      }
                    >
                      {lastRun.orchestrator.tradeDecision}
                    </strong>
                  </span>
                  <span className="text-slate-400">{lastRun.orchestrator.targetAsset}</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {lastRun.orchestrator.executiveSummary}
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Xử lý xung đột: {lastRun.orchestrator.conflictResolution}
                </p>

                {/* Proposed Parameter Patch Summary */}
                <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/10 text-[11px] font-mono-tabular text-slate-300">
                  <span>Cổ phiếu: {lastRun.orchestrator.paramsPatch.equityWeight}%</span>
                  <span>Trái phiếu: {lastRun.orchestrator.paramsPatch.bondWeight}%</span>
                  <span>Hàng hóa: {lastRun.orchestrator.paramsPatch.commodityWeight}%</span>
                  <span>Coin (BTC/ETH): {lastRun.orchestrator.paramsPatch.coinWeight ?? 0}%</span>
                  <span>Meme Coin: {lastRun.orchestrator.paramsPatch.memeCoinWeight ?? 0}%</span>
                  <span>Tiền mặt: {lastRun.orchestrator.paramsPatch.cashWeight}%</span>
                  <span>Lãi suất: {lastRun.orchestrator.paramsPatch.policyRate}%</span>
                  <span>
                    Phòng hộ: {lastRun.orchestrator.paramsPatch.hedgingActive ? 'Bật' : 'Tắt'}
                  </span>
                </div>

                {!autoApply && (
                  <button
                    type="button"
                    onClick={() =>
                      onApplyPatch(
                        lastRun.orchestrator.paramsPatch,
                        lastRun.orchestrator.executiveSummary,
                      )
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Áp dụng đề xuất vào Thế giới 3D
                  </button>
                )}
              </div>
            )}

            {/* Back-and-Forth Discussion Thread (Departments <-> Center CIO) */}
            {lastRun && lastRun.dialogueThread && lastRun.dialogueThread.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  Thảo luận qua lại (Departments ↔ Center CIO)
                </div>
                <div className="space-y-1.5 rounded-lg border border-white/10 bg-[#0B111A] p-3 max-h-56 overflow-y-auto custom-scroll">
                  {lastRun.dialogueThread.map((turn) => {
                    const isFromCenter = turn.fromId === 'center';
                    return (
                      <div
                        key={turn.id}
                        className={`rounded-md px-2.5 py-2 text-[11px] leading-relaxed border ${
                          isFromCenter
                            ? 'bg-amber-500/10 border-amber-400/25 text-amber-100'
                            : 'bg-[#121B2B] border-white/8 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px] font-mono-tabular text-slate-400 mb-0.5">
                          <span>
                            Vòng {turn.round} ·{' '}
                            <strong className={isFromCenter ? 'text-amber-300' : 'text-sky-300'}>
                              {turn.fromName}
                            </strong>{' '}
                            → {turn.toName}
                          </span>
                          {turn.stance && (
                            <span className={STANCE_LABEL[turn.stance].colorClass}>
                              {STANCE_LABEL[turn.stance].text}
                            </span>
                          )}
                        </div>
                        <div>{turn.message}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 7 Specialist Agent Reports + Supporting Tools Called */}
            {lastRun && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  Báo cáo & Công cụ hỗ trợ từ 7 Phòng ban
                </div>
                <div className="space-y-2">
                  {lastRun.specialistReports.map((rep) => {
                    const meta = ZONE_METADATA[rep.agentId];
                    const stance = STANCE_LABEL[rep.stance];
                    return (
                      <div
                        key={rep.agentId}
                        className="rounded-lg border border-white/10 bg-[#111927] p-3 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectZone(rep.agentId)}
                            className="flex items-center gap-1.5 font-semibold text-white hover:text-amber-300 transition-colors text-left"
                          >
                            <span
                              className="w-2 h-2 rounded-xs shrink-0"
                              style={{ backgroundColor: meta.accentHex }}
                            />
                            <span>{rep.agentName}</span>
                            <span className="text-slate-400 font-normal">· {meta.shortTitle}</span>
                            <ArrowUpRight className="w-3 h-3 text-slate-500" />
                          </button>
                          <span className={`font-medium shrink-0 ${stance.colorClass}`}>
                            {stance.text} · <span className="font-mono-tabular">{rep.confidence}%</span>
                          </span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{rep.summary}</p>
                        {rep.toolsCalled && rep.toolsCalled.length > 0 && (
                          <div className="rounded bg-[#0A1019] border border-cyan-500/20 px-2.5 py-1.5 space-y-0.5 text-[10.5px] font-mono-tabular">
                            {rep.toolsCalled.map((tool, i) => (
                              <div key={`${rep.agentId}-tool-${i}`} className="text-cyan-300 truncate">
                                Tool: {tool.toolName}({tool.argsSummary}) →{' '}
                                <span className="text-slate-200">{tool.resultSummary}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400">
                          Gửi Center: {rep.messageToCenter}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : activeTab === 'analysis' ? (
          /* Lệnh Yêu Cầu Phân Tích (N Phút) Tab */
          <div className="space-y-3.5">
            {/* Target Asset Selector */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-300">
                1. Chọn tài sản mục tiêu phân tích
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ANALYSIS_TARGETS.map((item) => {
                  const selected = assetTarget === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isAnalyzing}
                      onClick={() => handleSelectAnalysisTarget(item.id)}
                      className={`px-2.5 py-2 rounded-lg border text-left transition-colors disabled:opacity-60 ${
                        item.id === 'custom' ? 'col-span-2' : ''
                      } ${
                        selected
                          ? 'bg-sky-500/18 border-sky-400/60 text-white'
                          : 'bg-[#0B111A] border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="text-xs font-semibold truncate">{item.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{item.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Horizon N Minutes Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  2. Khung thời gian dự báo (N phút)
                </span>
                <span className="font-mono-tabular text-sky-300 text-[11px]">
                  {horizonMinutes} phút tới
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {HORIZON_PRESETS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    disabled={isAnalyzing}
                    onClick={() => handleSelectHorizon(mins)}
                    className={`px-2.5 py-1.5 rounded-lg border font-mono-tabular text-xs font-medium transition-colors ${
                      horizonMinutes === mins
                        ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                        : 'bg-[#0B111A] border-white/10 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {mins}p
                  </button>
                ))}
                <div className="flex-1 flex items-center justify-end gap-1.5">
                  <input
                    id="analysis-horizon-minutes"
                    aria-label="Số phút dự báo N"
                    type="number"
                    min={1}
                    max={1440}
                    disabled={isAnalyzing}
                    value={horizonMinutes}
                    onChange={(e) => handleSelectHorizon(Number(e.target.value))}
                    className="w-16 rounded-lg border border-white/15 bg-[#080D15] px-2 py-1.5 text-xs font-mono-tabular text-slate-100 text-right focus:outline-none focus:border-sky-400"
                  />
                  <span className="text-xs text-slate-400">phút</span>
                </div>
              </div>
            </div>

            {/* Analysis Command Prompt */}
            <div className="space-y-2">
              <label
                htmlFor="analysis-command-input"
                className="block text-xs font-medium text-slate-300"
              >
                3. Nhập lệnh yêu cầu phân tích
              </label>
              <textarea
                id="analysis-command-input"
                rows={3}
                value={analysisQuery}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Ví dụ: Trong vòng 15 phút tới là coin tăng hay giảm? Hoặc phân tích vàng trong forex..."
                className="w-full rounded-lg border border-white/15 bg-[#080D15] p-2.5 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-sky-400"
              />
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() =>
                  onRunAnalysis({
                    assetTarget,
                    horizonMinutes,
                    query: analysisQuery,
                  })
                }
                className="w-full px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/45 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Đang phân tích {horizonMinutes} phút tới...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Chạy lệnh phân tích ({horizonMinutes} phút)
                  </>
                )}
              </button>
            </div>

            {/* Analysis Error Display */}
            {analysisError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Không thể chạy lệnh phân tích</div>
                  <div className="mt-0.5 text-rose-200/90">{analysisError}</div>
                </div>
              </div>
            )}

            {/* Structured Forecast Result Card */}
            {analysisResult && (
              <div className="rounded-lg border border-sky-400/35 bg-[#101928] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {analysisResult.direction === 'TĂNG' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-bold flex items-center gap-1 shrink-0">
                        <TrendingUp className="w-3.5 h-3.5" />
                        TĂNG
                      </span>
                    ) : analysisResult.direction === 'GIẢM' ? (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-400/50 text-rose-300 text-xs font-bold flex items-center gap-1 shrink-0">
                        <TrendingDown className="w-3.5 h-3.5" />
                        GIẢM
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-bold flex items-center gap-1 shrink-0">
                        <Minus className="w-3.5 h-3.5" />
                        ĐI NGANG
                      </span>
                    )}
                    <span className="text-xs font-semibold text-white truncate">
                      {analysisResult.assetLabel}
                    </span>
                  </div>
                  <span className="font-mono-tabular text-[11px] text-slate-400 shrink-0">
                    Khung {analysisResult.horizonMinutes}p
                  </span>
                </div>

                {/* Probability, Expected Move & Action Strip */}
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-[#0A1019] border border-white/10 p-2.5 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Xác suất</div>
                    <div className="font-mono-tabular font-semibold text-slate-100">
                      {analysisResult.confidencePct}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Biên độ dự kiến</div>
                    <div
                      className={`font-mono-tabular font-semibold ${
                        analysisResult.expectedMovePct > 0
                          ? 'text-emerald-400'
                          : analysisResult.expectedMovePct < 0
                            ? 'text-rose-400'
                            : 'text-amber-300'
                      }`}
                    >
                      {analysisResult.expectedMovePct > 0 ? '+' : ''}
                      {analysisResult.expectedMovePct}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Khuyến nghị</div>
                    <div
                      className={`font-mono-tabular font-bold ${
                        analysisResult.recommendedAction === 'MUA'
                          ? 'text-emerald-400'
                          : analysisResult.recommendedAction === 'BÁN'
                            ? 'text-rose-400'
                            : 'text-amber-300'
                      }`}
                    >
                      {analysisResult.recommendedAction}
                    </div>
                  </div>
                </div>

                {/* Engine metadata */}
                <div className="text-[11px] font-mono-tabular text-slate-400 flex items-center justify-between">
                  <span>
                    Engine:{' '}
                    <strong className="text-sky-300">
                      {PROVIDER_SHORT_LABEL[analysisResult.provider]}
                    </strong>{' '}
                    · {analysisResult.model}
                  </span>
                  <span>{(analysisResult.latencyMs / 1000).toFixed(1)}s</span>
                </div>

                {/* Entry / Target / Stop-Loss */}
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <div className="rounded bg-[#0B111A] border border-white/8 p-2">
                    <div className="text-slate-400 text-[10px]">Vùng vào (Entry)</div>
                    <div className="font-mono-tabular text-slate-200 mt-0.5 break-words">
                      {analysisResult.entryZone}
                    </div>
                  </div>
                  <div className="rounded bg-[#0B111A] border border-emerald-500/25 p-2">
                    <div className="text-emerald-300/80 text-[10px]">Mục tiêu (TP)</div>
                    <div className="font-mono-tabular text-emerald-200 mt-0.5 break-words">
                      {analysisResult.targetPrice}
                    </div>
                  </div>
                  <div className="rounded bg-[#0B111A] border border-rose-500/25 p-2">
                    <div className="text-rose-300/80 text-[10px]">Cắt lỗ (SL)</div>
                    <div className="font-mono-tabular text-rose-200 mt-0.5 break-words">
                      {analysisResult.stopLossPrice}
                    </div>
                  </div>
                </div>

                {/* Executive Summary */}
                <p className="text-xs text-slate-200 leading-relaxed">{analysisResult.summary}</p>

                {/* Drivers */}
                {analysisResult.drivers && analysisResult.drivers.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-slate-300">Động lực chính</div>
                    <ul className="space-y-1 text-[11px] text-slate-300 list-disc pl-4">
                      {analysisResult.drivers.map((drv, idx) => (
                        <li key={`drv-${idx}`}>{drv}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Forex / DXY Correlation Note */}
                {analysisResult.forexCorrelationNote && (
                  <div className="rounded-md border border-amber-400/25 bg-amber-500/8 px-2.5 py-2 text-[11px] text-amber-100 leading-relaxed">
                    <strong className="text-amber-300">Tương quan Forex / DXY: </strong>
                    {analysisResult.forexCorrelationNote}
                  </div>
                )}

                {/* Risk Warning */}
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-[11px] text-rose-200 leading-relaxed">
                  <strong className="text-rose-300">Rủi ro cần lưu ý: </strong>
                  {analysisResult.riskWarning}
                </div>

                {/* Execute Action Into Portfolio */}
                {onApplyAnalysisTrade && (
                  <button
                    type="button"
                    onClick={() =>
                      onApplyAnalysisTrade(
                        analysisResult.assetTarget,
                        analysisResult.recommendedAction,
                        analysisResult.summary,
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Thực thi lệnh {analysisResult.recommendedAction} vào Danh mục 3D
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Phái sinh (Options & Futures Hedging) Tab */
          <div className="space-y-3.5">
            {/* Live Portfolio Risk Snapshot */}
            <div className="rounded-lg border border-white/10 bg-[#0B111A] p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Hồ sơ rủi ro danh mục hiện tại</span>
                <span
                  className={`font-mono-tabular text-[11px] font-semibold ${
                    currentVar95Pct > 14 || assetRiskBreaches.length > 0
                      ? 'text-rose-400'
                      : currentVar95Pct > 9
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                  }`}
                >
                  {currentVar95Pct > 14 || assetRiskBreaches.length > 0
                    ? 'Rủi ro cao · Cần phòng hộ'
                    : currentVar95Pct > 9
                      ? 'Rủi ro trung bình'
                      : 'Rủi ro kiểm soát'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1 border-t border-white/10 text-[11px]">
                <div>
                  <div className="text-[10px] text-slate-400">VaR 95%</div>
                  <div className="font-mono-tabular font-semibold text-rose-300">
                    -{currentVar95Pct}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">CVaR 95%</div>
                  <div className="font-mono-tabular font-semibold text-rose-400">
                    -{currentCvar95Pct}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Biến động</div>
                  <div className="font-mono-tabular font-semibold text-slate-100">
                    {currentVolPct}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Giảm VaR PS</div>
                  <div className="font-mono-tabular font-semibold text-cyan-300">
                    -{derivativeVaRReductionPct}%
                  </div>
                </div>
              </div>
            </div>

            {/* Instrument Focus Selector */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-300">
                1. Công cụ phái sinh phòng hộ
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'all', label: 'Options & Futures' },
                    { id: 'options', label: 'Quyền chọn (Options)' },
                    { id: 'futures', label: 'Tương lai (Futures)' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isProposingDerivatives}
                    onClick={() => setInstrumentFocus(item.id)}
                    className={`px-2 py-2 rounded-lg border text-[11px] font-semibold text-center transition-colors disabled:opacity-60 ${
                      instrumentFocus === item.id
                        ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                        : 'bg-[#0B111A] border-white/10 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hedging Directive & Quick Presets */}
            <div className="space-y-2">
              <label
                htmlFor="derivative-directive-input"
                className="block text-xs font-medium text-slate-300"
              >
                2. Chỉ thị phòng hộ gửi Agent Swarm
              </label>
              <textarea
                id="derivative-directive-input"
                rows={2}
                value={derivativeDirective}
                onChange={(e) => setDerivativeDirective(e.target.value)}
                placeholder="Nhập mục tiêu phòng hộ danh mục bằng Options hoặc Futures..."
                className="w-full rounded-lg border border-white/15 bg-[#080D15] p-2.5 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-cyan-400"
              />
              <div className="flex flex-wrap gap-1.5">
                {DERIVATIVE_DIRECTIVES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isProposingDerivatives}
                    onClick={() => {
                      setDerivativeDirective(preset);
                      onProposeDerivatives({ instrumentFocus, directive: preset });
                    }}
                    className="px-2.5 py-1 rounded-md bg-[#141D2D] hover:bg-[#1D2A40] border border-white/10 text-[11px] text-slate-300 text-left transition-colors disabled:opacity-50"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={isProposingDerivatives}
                onClick={() =>
                  onProposeDerivatives({
                    instrumentFocus,
                    directive: derivativeDirective,
                  })
                }
                className="w-full px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/45 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                {isProposingDerivatives ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Swarm đang thiết kế hợp đồng Phái sinh...
                  </>
                ) : (
                  <>
                    <Shield className="w-3.5 h-3.5" />
                    Yêu cầu Swarm đề xuất Phái sinh
                  </>
                )}
              </button>
            </div>

            {/* Derivative Error Banner */}
            {derivativeError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Không thể tạo đề xuất Phái sinh</div>
                  <div className="mt-0.5 text-rose-200/90">{derivativeError}</div>
                </div>
              </div>
            )}

            {/* Proposed Derivative Contracts from Swarm */}
            {derivativeResult && (
              <div className="space-y-2.5">
                <div className="rounded-lg border border-cyan-400/35 bg-[#101928] p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-cyan-300">
                      Mức độ rủi ro: {derivativeResult.portfolioRiskLevel}
                    </span>
                    <span className="font-mono-tabular text-slate-400">
                      Hedge khuyến nghị: {derivativeResult.recommendedHedgeRatioPct}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {derivativeResult.riskAssessment}
                  </p>
                  <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-400 pt-1 border-t border-white/10">
                    <span>
                      Engine: {PROVIDER_SHORT_LABEL[derivativeResult.provider]} ·{' '}
                      {derivativeResult.model}
                    </span>
                    <span>{(derivativeResult.latencyMs / 1000).toFixed(1)}s</span>
                  </div>
                  {derivativeResult.proposals.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onExecuteAllDerivatives(derivativeResult.proposals)}
                      className="w-full px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/45 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Thực thi toàn bộ ({derivativeResult.proposals.length} hợp đồng phòng hộ)
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {derivativeResult.proposals.map((prop) => {
                    const isOpened = activeDerivatives.some((a) => a.ticker === prop.ticker);
                    const isOption =
                      prop.instrumentType === 'put_option' ||
                      prop.instrumentType === 'call_option';
                    return (
                      <div
                        key={prop.id}
                        className="rounded-lg border border-white/10 bg-[#111927] p-3.5 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate">
                              {prop.instrumentLabel}
                            </div>
                            <div className="text-[11px] font-mono-tabular text-cyan-300 mt-0.5">
                              {prop.ticker} · {prop.underlyingLabel} · Đề xuất: {prop.proposingAgent}
                            </div>
                          </div>
                          <span
                            className={`text-[11px] font-mono-tabular font-semibold shrink-0 ${
                              isOption ? 'text-amber-300' : 'text-sky-300'
                            }`}
                          >
                            {isOption ? 'OPTIONS' : `FUTURES ${prop.leverage}x`}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 rounded bg-[#0A1019] border border-white/8 p-2 text-[11px] font-mono-tabular">
                          <div>
                            <div className="text-[10px] text-slate-400">Quy mô (Notional)</div>
                            <div className="text-slate-100 font-semibold">
                              {formatUsd(prop.notionalUsd)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400">Phủ rủi ro</div>
                            <div className="text-slate-100 font-semibold">{prop.coveragePct}%</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400">Giảm VaR</div>
                            <div className="text-emerald-400 font-semibold">
                              -{prop.estimatedVarReductionPct}%
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400">
                              {isOption ? 'Giá thực hiện' : 'Giá vào (Entry)'}
                            </div>
                            <div className="text-slate-200 truncate">{prop.strikeOrEntry}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400">Kỳ hạn</div>
                            <div className="text-slate-200">{prop.expiryDays} ngày</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400">
                              {isOption ? 'Phí Premium' : 'Ký quỹ (Margin)'}
                            </div>
                            <div className="text-amber-200">
                              {formatUsd(prop.premiumOrMarginUsd)}
                            </div>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {prop.rationale}
                        </p>
                        <div className="text-[10.5px] text-slate-400">
                          Lưu ý rủi ro: {prop.riskNote}
                        </div>

                        <button
                          type="button"
                          disabled={isOpened}
                          onClick={() => onExecuteDerivative(prop)}
                          className={`w-full px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            isOpened
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300/75 cursor-default'
                              : 'bg-cyan-500/18 hover:bg-cyan-500/28 border-cyan-400/50 text-cyan-200'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {isOpened ? 'Đã mở vị thế phòng hộ' : 'Thực thi hợp đồng'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Hedging Contracts List */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">
                  Vị thế Phái sinh đang mở ({activeDerivatives.length})
                </span>
                {activeDerivatives.length > 0 && (
                  <span className="font-mono-tabular text-[11px] text-emerald-300">
                    Tổng giảm VaR: -{derivativeVaRReductionPct}%
                  </span>
                )}
              </div>

              {activeDerivatives.length === 0 ? (
                <div className="rounded-lg border border-white/8 bg-[#0A1019] p-3 text-xs text-slate-400">
                  Chưa có hợp đồng Options hoặc Futures nào đang mở. Nhấn{' '}
                  <strong className="text-cyan-300">Yêu cầu Swarm đề xuất Phái sinh</strong> để các
                  Agent thiết kế vị thế phòng hộ theo VaR hiện tại.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {activeDerivatives.map((pos) => (
                    <div
                      key={pos.id}
                      className="rounded-lg border border-emerald-500/30 bg-[#0E1A22] px-3 py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-100 truncate">
                          {pos.ticker} · {pos.instrumentLabel}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-slate-400 mt-0.5">
                          {pos.underlyingLabel} · {formatUsd(pos.notionalUsd)} · Giảm VaR{' '}
                          <span className="text-emerald-400">-{pos.estimatedVarReductionPct}%</span>{' '}
                          · T+{pos.openedAtTick}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onCloseDerivative(pos.id)}
                        title="Đóng vị thế phái sinh"
                        className="px-2.5 py-1.5 rounded-md border border-rose-500/35 bg-rose-500/12 hover:bg-rose-500/25 text-rose-200 text-[11px] font-medium flex items-center gap-1 shrink-0 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Đóng
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
