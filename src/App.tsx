import { useCallback, useEffect, useRef, useState } from 'react';
import { ControlDock } from './components/ControlDock';
import { LogTraceOverlay } from './components/LogTraceOverlay';
import { MacroChartOverview } from './components/MacroChartOverview';
import { SwarmPanel, SwarmPanelTab } from './components/SwarmPanel';
import { TopBar } from './components/TopBar';
import { TradeHistoryModal } from './components/TradeHistoryModal';
import { WorldCanvas } from './components/WorldCanvas';
import { ZoneInspector } from './components/ZoneInspector';
import {
  INITIAL_PARAMS,
  computeSimulationStep,
  formatUsd,
} from './simulation/financialEngine';
import {
  ActiveDerivativePosition,
  AnalysisAssetTarget,
  AssetAnalysisResult,
  AssetClassId,
  AssetRiskBreach,
  DecisionCategoryTag,
  DerivativeContractProposal,
  DerivativeSwarmResult,
  LlmProviderId,
  ProviderQuotaInfo,
  QuotaSettings,
  SimulationParams,
  SimulationState,
  SwarmRunResult,
  SwarmStatus,
  TraceLogEntry,
  TradeAction,
  ZoneId,
} from './types/finance';

function buildUrgentBreachMission(breaches: AssetRiskBreach[]): string {
  const details = breaches
    .map(
      (b) =>
        `${b.label} (${b.ticker}, tỷ trọng ${b.weightPct}%): Vol ${b.volatilityPct}%, VaR ${b.var95Pct}% > Ngưỡng ${b.thresholdPct}%`,
    )
    .join('; ');
  return `KHẨN CẤP - ƯU TIÊN XỬ LÝ GẤP: Phát hiện vượt Ngưỡng Rủi Ro Tối Đa tại [${details}]. Yêu cầu 7 phòng ban gọi công cụ kiểm chứng ngay và đề xuất lệnh BÁN/hạ tỷ trọng hoặc bật phòng hộ để đưa VaR & biến động về dưới ngưỡng.`;
}

const DEFAULT_PROVIDERS: ProviderQuotaInfo[] = [
  {
    provider: 'gemini',
    label: 'Google Gemini',
    envVarName: 'GEMINI_API_KEY',
    configured: false,
    defaultModel: 'gemini-4-hydrogen',
    availableModels: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
    dailyLimit: 20,
    usedToday: 0,
    remainingToday: 20,
  },
  {
    provider: 'openai',
    label: 'OpenAI',
    envVarName: 'OPENAI_API_KEY',
    configured: false,
    defaultModel: 'gpt-4o-mini',
    availableModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    dailyLimit: 200,
    usedToday: 0,
    remainingToday: 200,
  },
  {
    provider: 'anthropic',
    label: 'Anthropic Claude',
    envVarName: 'ANTHROPIC_API_KEY',
    configured: false,
    defaultModel: 'claude-3-5-haiku-latest',
    availableModels: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest'],
    dailyLimit: 200,
    usedToday: 0,
    remainingToday: 200,
  },
  {
    provider: 'openrouter',
    label: 'OpenRouter',
    envVarName: 'OPENROUTER_API_KEY',
    configured: false,
    defaultModel: 'openai/gpt-4o-mini',
    availableModels: [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.5-flash',
    ],
    dailyLimit: 200,
    usedToday: 0,
    remainingToday: 200,
  },
];

function nowTimeStr(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

const ASSET_PARAM_KEY: Record<
  AssetClassId,
  'equityWeight' | 'bondWeight' | 'commodityWeight' | 'coinWeight' | 'memeCoinWeight' | 'cashWeight'
> = {
  equity: 'equityWeight',
  bond: 'bondWeight',
  commodity: 'commodityWeight',
  coin: 'coinWeight',
  memeCoin: 'memeCoinWeight',
  cash: 'cashWeight',
};

export default function App() {
  const [params, setParams] = useState<SimulationParams>(INITIAL_PARAMS);
  const [simState, setSimState] = useState<SimulationState>(() =>
    computeSimulationStep(INITIAL_PARAMS, null, 1),
  );
  const [selectedZone, setSelectedZone] = useState<ZoneId>('overview');
  const [isRunning, setIsRunning] = useState(true);
  const [speed, setSpeed] = useState<1 | 2 | 5>(1);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [zenMode, setZenMode] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cameraResetTrigger, setCameraResetTrigger] = useState(0);

  // On-Screen Trace Logs
  const [traceVisible, setTraceVisible] = useState(true);
  const [traceLogs, setTraceLogs] = useState<TraceLogEntry[]>(() => [
    {
      id: 'trace-init-0',
      tick: 1,
      timestamp: nowTimeStr(),
      source: 'Center · Init',
      category: 'init',
      message: `Khởi tạo vốn hóa giả lập ${formatUsd(INITIAL_PARAMS.initialCapitalUsd)}`,
      detail: 'Kích hoạt 6 lớp tài sản: Cổ phiếu, Trái phiếu, Hàng hóa, Coin, Meme Coin, Tiền mặt.',
    },
  ]);

  // Real Agent Swarm + Multi-Provider & Quota State
  const [swarmOpen, setSwarmOpen] = useState(false);
  const [swarmTab, setSwarmTab] = useState<SwarmPanelTab>('swarm');
  const [swarmStatus, setSwarmStatus] = useState<SwarmStatus>('idle');
  const [swarmError, setSwarmError] = useState<string | null>(null);
  const [swarmMission, setSwarmMission] = useState(
    'Tối ưu phân bổ vốn hóa, đánh giá Coin/Meme Coin và ra quyết định MUA / GIỮ / BÁN.',
  );
  const [swarmAutopilot, setSwarmAutopilot] = useState(false);
  const [swarmCountdownSec, setSwarmCountdownSec] = useState(5);
  const [swarmAutoApply, setSwarmAutoApply] = useState(true);
  const [lastSwarmRun, setLastSwarmRun] = useState<SwarmRunResult | null>(null);

  // Asset Analysis Command (N-minute direction forecast) State
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'analyzing' | 'error'>('idle');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AssetAnalysisResult | null>(null);

  // Derivatives Hedging (Options & Futures) State
  const [derivativeStatus, setDerivativeStatus] = useState<'idle' | 'proposing' | 'error'>('idle');
  const [derivativeError, setDerivativeError] = useState<string | null>(null);
  const [derivativeResult, setDerivativeResult] = useState<DerivativeSwarmResult | null>(null);

  const [selectedProvider, setSelectedProvider] = useState<LlmProviderId>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-4-hydrogen');
  const [providers, setProviders] = useState<ProviderQuotaInfo[]>(DEFAULT_PROVIDERS);
  const [quotaSettings, setQuotaSettings] = useState<QuotaSettings>({
    minIntervalSec: 5,
    autoFallbackOn429: true,
  });
  const [testingProvider, setTestingProvider] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    provider: LlmProviderId;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const paramsRef = useRef(params);
  paramsRef.current = params;

  const stateRef = useRef(simState);
  stateRef.current = simState;

  const autoApplyRef = useRef(swarmAutoApply);
  autoApplyRef.current = swarmAutoApply;

  const swarmBusyRef = useRef(false);
  const noiseSeedRef = useRef(1.37);

  const minIntervalRef = useRef(quotaSettings.minIntervalSec);
  minIntervalRef.current = quotaSettings.minIntervalSec;

  const pushTrace = useCallback((entry: Omit<TraceLogEntry, 'id' | 'timestamp'>) => {
    setTraceLogs((prev) => [
      {
        ...entry,
        id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowTimeStr(),
      },
      ...prev.slice(0, 39),
    ]);
  }, []);

  const fetchProviderStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/providers/status');
      if (!res.ok) return;
      const data = (await res.json()) as {
        providers?: ProviderQuotaInfo[];
        quotaSettings?: QuotaSettings;
      };
      if (Array.isArray(data.providers)) setProviders(data.providers);
      if (data.quotaSettings) setQuotaSettings(data.quotaSettings);
    } catch {
      // Ignore transient mount fetch errors
    }
  }, []);

  useEffect(() => {
    void fetchProviderStatus();
  }, [fetchProviderStatus]);

  useEffect(() => {
    if (swarmOpen) {
      void fetchProviderStatus();
    }
  }, [swarmOpen, fetchProviderStatus]);

  const handleSelectProvider = useCallback(
    (pid: LlmProviderId) => {
      setSelectedProvider(pid);
      const found = providers.find((p) => p.provider === pid);
      if (found) {
        setSelectedModel(found.defaultModel);
      }
      setTestResult(null);
      setSwarmError(null);
    },
    [providers],
  );

  const handleTestConnection = useCallback(async () => {
    setTestingProvider(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        latencyMs?: number;
        reply?: string;
        model?: string;
        error?: string;
        providers?: ProviderQuotaInfo[];
      };
      if (Array.isArray(data.providers)) setProviders(data.providers);

      if (!res.ok || !data.ok) {
        const errMsg = data.error || `HTTP ${res.status}`;
        setTestResult({
          ok: false,
          provider: selectedProvider,
          message: errMsg,
        });
        pushTrace({
          tick: stateRef.current.tick,
          source: `Provider · ${selectedProvider.toUpperCase()}`,
          category: 'risk',
          message: 'Test Connection thất bại',
          detail: errMsg,
        });
      } else {
        const okMsg = `Kết nối thành công (${data.model ?? selectedModel} · ${data.latencyMs ?? 0}ms · "${data.reply ?? 'OK'}")`;
        setTestResult({
          ok: true,
          provider: selectedProvider,
          message: okMsg,
          latencyMs: data.latencyMs,
        });
        pushTrace({
          tick: stateRef.current.tick,
          source: `Provider · ${selectedProvider.toUpperCase()}`,
          category: 'swarm',
          message: `Test Connection OK (${data.latencyMs ?? 0}ms)`,
          detail: data.model ?? selectedModel,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.';
      setTestResult({ ok: false, provider: selectedProvider, message: msg });
    } finally {
      setTestingProvider(false);
    }
  }, [selectedProvider, selectedModel, pushTrace]);

  const handleUpdateQuota = useCallback(
    async (patch: {
      dailyLimit?: number;
      minIntervalSec?: number;
      autoFallbackOn429?: boolean;
      resetUsed?: boolean;
    }) => {
      try {
        const res = await fetch('/api/providers/quota', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: selectedProvider,
            ...patch,
          }),
        });
        const data = (await res.json()) as {
          providers?: ProviderQuotaInfo[];
          quotaSettings?: QuotaSettings;
        };
        if (Array.isArray(data.providers)) setProviders(data.providers);
        if (data.quotaSettings) {
          setQuotaSettings(data.quotaSettings);
          setSwarmCountdownSec(Math.max(5, data.quotaSettings.minIntervalSec));
        }
      } catch {
        // Ignore network failure on quota update
      }
    },
    [selectedProvider],
  );

  // Real-time simulation tick + automatic signal-flip trace detection
  useEffect(() => {
    if (!isRunning) return;
    const intervalMs = Math.round(1200 / speed);
    const timer = window.setInterval(() => {
      noiseSeedRef.current += 0.31;
      const prevState = stateRef.current;
      const nextState = computeSimulationStep(
        paramsRef.current,
        prevState,
        noiseSeedRef.current,
      );
      setSimState(nextState);

      // Detect Coin / Meme Coin / overall signal shifts
      if (prevState.overallTradeAction !== nextState.overallTradeAction) {
        pushTrace({
          tick: nextState.tick,
          source: 'Center · Tín hiệu',
          category: 'trade',
          tradeAction: nextState.overallTradeAction,
          message: `Chuyển trạng thái danh mục sang ${nextState.overallTradeAction}`,
          detail: `Vốn hóa ${formatUsd(nextState.capitalUsd)} · VaR -${nextState.var95Pct}%`,
        });
      } else {
        for (const sig of nextState.assetSignals) {
          const oldSig = prevState.assetSignals.find((s) => s.id === sig.id);
          if (oldSig && oldSig.action !== sig.action) {
            pushTrace({
              tick: nextState.tick,
              source: `Model · ${sig.ticker}`,
              category: 'trade',
              tradeAction: sig.action,
              message: `${sig.action} ${sig.label} (${formatUsd(sig.marketValueUsd)})`,
              detail: sig.reason,
            });
            break;
          }
        }
      }

      if (
        nextState.covenantBreaches.length > prevState.covenantBreaches.length &&
        nextState.covenantBreaches[0]
      ) {
        pushTrace({
          tick: nextState.tick,
          source: 'Lawer-2 · Covenant',
          category: 'risk',
          message: nextState.covenantBreaches[0],
          detail: `Rủi ro ĐT ${nextState.investmentRiskScore}/100`,
        });
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isRunning, speed, pushTrace]);

  // Keyboard shortcuts: H for Zen Mode, Escape to close drawers/return to Overview
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setZenMode((z) => !z);
      } else if (e.key === 'Escape') {
        setHistoryOpen((isOpen) => {
          if (isOpen) return false;
          setSwarmOpen(false);
          setSelectedZone('overview');
          return false;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleUpdateParams = useCallback((patch: Partial<SimulationParams>) => {
    setParams((prevParams) => {
      const nextParams = { ...prevParams, ...patch };
      paramsRef.current = nextParams;
      setSimState((prevState) =>
        computeSimulationStep(nextParams, prevState, noiseSeedRef.current),
      );
      return nextParams;
    });
  }, []);

  const handleExecuteDecision = useCallback(
    (
      action: string,
      detail: string,
      meta?: { tradeType?: DecisionCategoryTag; assetLabel?: string },
    ) => {
      const curTick = stateRef.current.tick;
      const timestamp = nowTimeStr();
      const tradeTag: TradeAction | undefined = action.startsWith('MUA')
        ? 'MUA'
        : action.startsWith('BÁN')
          ? 'BÁN'
          : action.startsWith('GIỮ')
            ? 'GIỮ'
            : undefined;
      const resolvedCategory: DecisionCategoryTag =
        meta?.tradeType ??
        tradeTag ??
        (action.includes('Agent Swarm')
          ? 'SWARM'
          : action.startsWith('Kịch bản:')
            ? 'SCENARIO'
            : 'INIT');

      setSimState((prev) => ({
        ...prev,
        decisionLog: [
          {
            id: `dec-${Date.now()}-${prev.tick}-${Math.random().toString(36).slice(2, 6)}`,
            tick: prev.tick,
            timestamp,
            action,
            tradeType: resolvedCategory,
            assetLabel: meta?.assetLabel ?? 'Danh mục tổng hợp',
            capitalUsd: prev.capitalUsd,
            nav: prev.nav,
            detail,
            deltaReturnPct: prev.expectedReturnPct,
          },
          ...prev.decisionLog,
        ],
      }));
      pushTrace({
        tick: curTick,
        source: 'Center · Quyết định',
        category: 'trade',
        tradeAction: tradeTag,
        message: action,
        detail,
      });
    },
    [pushTrace],
  );

  const handleInitCapital = useCallback(
    (capitalUsd: number) => {
      handleUpdateParams({ initialCapitalUsd: capitalUsd });
      handleExecuteDecision(
        `Khởi tạo vốn hóa ${formatUsd(capitalUsd)}`,
        'Đồng bộ định giá 6 lớp tài sản theo vốn hóa giả lập mới.',
        { tradeType: 'INIT', assetLabel: 'Vốn hóa giả lập' },
      );
    },
    [handleUpdateParams, handleExecuteDecision],
  );

  const handleExecuteTrade = useCallback(
    (assetId: AssetClassId, assetLabel: string, action: TradeAction) => {
      const paramKey = ASSET_PARAM_KEY[assetId];
      const curVal = paramsRef.current[paramKey];
      const maxCap = assetId === 'memeCoin' ? 25 : assetId === 'coin' ? 45 : 80;
      const nextVal =
        action === 'MUA'
          ? Math.min(maxCap, curVal + 6)
          : action === 'BÁN'
            ? Math.max(0, curVal - 6)
            : curVal;

      if (nextVal !== curVal) {
        handleUpdateParams({ [paramKey]: nextVal });
      }

      const assetState = stateRef.current.assetSignals.find((a) => a.id === assetId);
      const notional = assetState ? formatUsd(assetState.marketValueUsd) : '';
      handleExecuteDecision(
        `${action} ${assetLabel}`,
        `Tỷ trọng ${curVal} → ${nextVal} · Quy mô ${notional} · Vốn hóa ${formatUsd(stateRef.current.capitalUsd)}.`,
        {
          tradeType: action,
          assetLabel: assetState ? `${assetLabel} (${assetState.ticker})` : assetLabel,
        },
      );
    },
    [handleUpdateParams, handleExecuteDecision],
  );

  const handleApplySwarmPatch = useCallback(
    (patch: Partial<SimulationParams>, summary: string, tradeAction?: TradeAction) => {
      handleUpdateParams(patch);
      const prefix = tradeAction ? `${tradeAction} (Agent Swarm)` : 'Agent Swarm thực thi';
      handleExecuteDecision(prefix, summary, {
        tradeType: tradeAction ?? 'SWARM',
        assetLabel: 'Điều phối Agent Swarm',
      });
    },
    [handleUpdateParams, handleExecuteDecision],
  );

  const handleRunSwarm = useCallback(
    async (customMission?: string, urgentPriority?: boolean) => {
      if (swarmBusyRef.current) return;
      swarmBusyRef.current = true;
      setSwarmStatus('deliberating');
      setSwarmError(null);

      const activeBreaches = stateRef.current.assetRiskBreaches ?? [];
      const isUrgent = Boolean(urgentPriority || activeBreaches.length > 0);
      const effectiveMission =
        customMission ??
        (activeBreaches.length > 0 ? buildUrgentBreachMission(activeBreaches) : swarmMission);

      pushTrace({
        tick: stateRef.current.tick,
        source: isUrgent
          ? `Agent Swarm KHẨN CẤP · ${selectedProvider.toUpperCase()}`
          : `Agent Swarm · ${selectedProvider.toUpperCase()}`,
        category: isUrgent ? 'risk' : 'swarm',
        severity: isUrgent ? 'critical' : 'normal',
        message: isUrgent
          ? `Ưu tiên xử lý gấp ${activeBreaches.length} tài sản vượt ngưỡng (${selectedModel})...`
          : `Hội tụ 7 Specialist Agents + Center CIO (${selectedModel})...`,
        detail: effectiveMission,
      });

      try {
        const res = await fetch('/api/swarm/deliberate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: selectedProvider,
            model: selectedModel,
            mission: effectiveMission,
            urgentPriority: isUrgent,
            urgentBreaches: activeBreaches,
            params: paramsRef.current,
            state: stateRef.current,
          }),
        });

        const payload = (await res.json()) as SwarmRunResult & {
          error?: string;
          providers?: ProviderQuotaInfo[];
        };
        if (Array.isArray(payload.providers)) {
          setProviders(payload.providers);
        }
        if (!res.ok) {
          throw new Error(payload.error || `HTTP ${res.status}`);
        }

        setLastSwarmRun(payload);
        setSwarmStatus('idle');

        // 1. Trace supporting tools actually invoked by departments
        const toolEntries = payload.specialistReports.flatMap((rep) =>
          (rep.toolsCalled ?? []).map((t) => `${rep.agentName}:${t.toolName}(${t.resultSummary})`),
        );
        if (toolEntries.length > 0) {
          pushTrace({
            tick: stateRef.current.tick,
            source: '7 Phòng ban · Tools',
            category: 'tool',
            message: `Tự gọi ${toolEntries.length} công cụ phân tích hỗ trợ`,
            detail: toolEntries.slice(0, 3).join(' · '),
          });
        }

        // 2. Trace Round 2 back-and-forth discussion between Center CIO and Departments
        const round2Turns = (payload.dialogueThread ?? []).filter((d) => d.round === 2);
        if (round2Turns.length >= 2) {
          const q = round2Turns[0];
          const a = round2Turns[1];
          pushTrace({
            tick: stateRef.current.tick,
            source: `${q.fromName} ↔ ${a.fromName}`,
            category: 'dialogue',
            message: q.message,
            detail: `Phản hồi (${a.fromName}): ${a.message}`,
          });
        }

        // 3. Emit trace for Center CIO final consensus decision
        const activeEngine = payload.provider
          ? `${payload.provider.toUpperCase()} · ${payload.model}`
          : payload.model;
        pushTrace({
          tick: stateRef.current.tick,
          source: `Center CIO (${activeEngine})`,
          category: 'swarm',
          tradeAction: payload.orchestrator.tradeDecision,
          message: `${payload.orchestrator.tradeDecision} · ${payload.orchestrator.targetAsset}`,
          detail: `${payload.orchestrator.consensusStance} (${payload.orchestrator.confidence}%) · ${(payload.latencyMs / 1000).toFixed(1)}s`,
        });

        if (autoApplyRef.current && payload.orchestrator?.paramsPatch) {
          handleApplySwarmPatch(
            payload.orchestrator.paramsPatch,
            payload.orchestrator.executiveSummary,
            payload.orchestrator.tradeDecision,
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Lỗi kết nối máy chủ Agent Swarm.';
        setSwarmError(msg);
        setSwarmStatus('error');
        setSwarmAutopilot(false);
        pushTrace({
          tick: stateRef.current.tick,
          source: 'Agent Swarm',
          category: 'risk',
          message: `Tạm dừng lịch ${minIntervalRef.current}s do lỗi từ máy chủ Swarm`,
          detail: msg,
        });
      } finally {
        swarmBusyRef.current = false;
        setSwarmCountdownSec(Math.max(5, minIntervalRef.current));
      }
    },
    [selectedProvider, selectedModel, swarmMission, handleApplySwarmPatch, pushTrace],
  );

  // Scheduled autonomous Swarm loop respecting Quota minIntervalSec
  useEffect(() => {
    if (!swarmAutopilot) return;
    const intervalSec = Math.max(5, quotaSettings.minIntervalSec);
    const timer = window.setInterval(() => {
      if (swarmBusyRef.current) return;
      setSwarmCountdownSec((prev) => {
        if (prev <= 1) {
          const breaches = stateRef.current.assetRiskBreaches ?? [];
          if (breaches.length > 0) {
            void handleRunSwarm(buildUrgentBreachMission(breaches), true);
          } else {
            void handleRunSwarm();
          }
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [swarmAutopilot, quotaSettings.minIntervalSec, handleRunSwarm]);

  // Auto Red Alert Trace Log & Urgent Swarm Priority Dispatch when Asset Max Risk Threshold is breached
  const prevBreachedAssetsRef = useRef<Set<AssetClassId>>(new Set());
  const lastUrgentSwarmAtRef = useRef<number>(0);
  const urgentTimerRef = useRef<number | null>(null);
  const providersRef = useRef(providers);
  providersRef.current = providers;
  const selectedProviderRef = useRef(selectedProvider);
  selectedProviderRef.current = selectedProvider;
  const quotaSettingsRef = useRef(quotaSettings);
  quotaSettingsRef.current = quotaSettings;
  const handleRunSwarmRef = useRef(handleRunSwarm);
  handleRunSwarmRef.current = handleRunSwarm;

  const handleRunUrgentSwarm = useCallback(() => {
    const breaches = stateRef.current.assetRiskBreaches ?? [];
    const urgentMission =
      breaches.length > 0
        ? buildUrgentBreachMission(breaches)
        : 'KHẨN CẤP: Kiểm tra và giảm thiểu rủi ro biến động & VaR danh mục.';
    setSwarmMission(urgentMission);
    setSwarmOpen(true);
    setSelectedZone('overview');
    lastUrgentSwarmAtRef.current = Date.now();
    void handleRunSwarm(urgentMission, true);
  }, [handleRunSwarm]);

  useEffect(() => {
    return () => {
      if (urgentTimerRef.current !== null) {
        window.clearTimeout(urgentTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const breaches = simState.assetRiskBreaches ?? [];
    const currentSet = new Set(breaches.map((b) => b.assetId));
    const newlyBreached = breaches.filter((b) => !prevBreachedAssetsRef.current.has(b.assetId));
    prevBreachedAssetsRef.current = currentSet;

    if (newlyBreached.length === 0) return;

    for (const b of newlyBreached) {
      pushTrace({
        tick: simState.tick,
        source: `Risk Guard · ${b.ticker}`,
        category: 'risk',
        severity: 'critical',
        message: `${b.label} vượt Ngưỡng Rủi Ro Tối Đa (${b.triggerMetric})`,
        detail: `Biến động ${b.volatilityPct}% · VaR 95% ${b.var95Pct}% > Ngưỡng ${b.thresholdPct}% (vượt +${b.excessPct}%) — Ưu tiên Swarm xử lý gấp!`,
      });
    }

    const urgentMission = buildUrgentBreachMission(breaches);
    setSwarmMission(urgentMission);

    if (urgentTimerRef.current !== null) {
      window.clearTimeout(urgentTimerRef.current);
    }

    urgentTimerRef.current = window.setTimeout(() => {
      urgentTimerRef.current = null;
      const nowMs = Date.now();
      const qs = quotaSettingsRef.current;
      const cooldownMs = Math.max(8000, qs.minIntervalSec * 1000);
      if (swarmBusyRef.current || nowMs - lastUrgentSwarmAtRef.current < cooldownMs) {
        return;
      }

      const curProviders = providersRef.current;
      const activeProv = curProviders.find((p) => p.provider === selectedProviderRef.current);
      const hasFallback =
        qs.autoFallbackOn429 &&
        curProviders.some((p) => p.configured && p.remainingToday >= 2);
      const canRun = Boolean(
        (activeProv?.configured && (activeProv.remainingToday ?? 0) >= 2) || hasFallback,
      );

      if (!canRun) {
        pushTrace({
          tick: stateRef.current.tick,
          source: 'Risk Guard · Swarm Queue',
          category: 'risk',
          severity: 'critical',
          message: 'Đã xếp hàng ưu tiên xử lý gấp (chờ Provider / Quota sẵn sàng)',
          detail:
            'Chuyển Provider hoặc bấm Reset Quota trong bảng Agent Swarm để kích hoạt xử lý khẩn cấp.',
        });
        return;
      }

      lastUrgentSwarmAtRef.current = nowMs;
      void handleRunSwarmRef.current(urgentMission, true);
    }, 650);
  }, [simState.assetRiskBreaches, simState.tick, pushTrace]);

  const handleApplyScenario = useCallback(
    (label: string, patch: Partial<SimulationParams>) => {
      handleUpdateParams(patch);
      handleExecuteDecision(`Kịch bản: ${label}`, 'Cập nhật tham số vĩ mô toàn thế giới 3D.', {
        tradeType: 'SCENARIO',
        assetLabel: 'Tham số vĩ mô 3D',
      });
    },
    [handleUpdateParams, handleExecuteDecision],
  );

  const handleSelectZone = useCallback((zone: ZoneId) => {
    if (zone !== 'overview') {
      setSwarmOpen(false);
    }
    setSelectedZone(zone);
    setCameraResetTrigger((c) => c + 1);
  }, []);

  const handleRunAnalysis = useCallback(
    async ({
      assetTarget,
      horizonMinutes,
      query,
    }: {
      assetTarget: AnalysisAssetTarget;
      horizonMinutes: number;
      query: string;
    }) => {
      setAnalysisStatus('analyzing');
      setAnalysisError(null);

      pushTrace({
        tick: stateRef.current.tick,
        source: `Phân Tích · ${selectedProvider.toUpperCase()}`,
        category: 'tool',
        message: `Chạy lệnh phân tích (${horizonMinutes} phút): ${assetTarget.toUpperCase()}`,
        detail: query,
      });

      try {
        const res = await fetch('/api/analyze/asset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: selectedProvider,
            model: selectedModel,
            assetTarget,
            horizonMinutes,
            query,
            params: paramsRef.current,
            state: stateRef.current,
          }),
        });

        const payload = (await res.json()) as AssetAnalysisResult & {
          error?: string;
          providers?: ProviderQuotaInfo[];
        };
        if (Array.isArray(payload.providers)) {
          setProviders(payload.providers);
        }
        if (!res.ok) {
          throw new Error(payload.error || `HTTP ${res.status}`);
        }

        setAnalysisResult(payload);
        setAnalysisStatus('idle');

        pushTrace({
          tick: stateRef.current.tick,
          source: `Phân Tích · ${payload.assetLabel}`,
          category: 'trade',
          tradeAction: payload.recommendedAction,
          message: `Dự báo ${payload.direction} trong ${payload.horizonMinutes} phút (${payload.confidencePct}%)`,
          detail: `Biên độ ${payload.expectedMovePct > 0 ? '+' : ''}${payload.expectedMovePct}% · Entry ${payload.entryZone} · TP ${payload.targetPrice}`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Lỗi kết nối máy chủ phân tích.';
        setAnalysisError(msg);
        setAnalysisStatus('error');
        pushTrace({
          tick: stateRef.current.tick,
          source: 'Phân Tích · Lỗi',
          category: 'risk',
          message: 'Lệnh phân tích không thể hoàn tất',
          detail: msg,
        });
      }
    },
    [selectedProvider, selectedModel, pushTrace],
  );

  const handleApplyAnalysisTrade = useCallback(
    (assetTarget: AnalysisAssetTarget, action: TradeAction, summary: string) => {
      if (assetTarget === 'gold' || assetTarget === 'gold_forex') {
        handleExecuteTrade('commodity', 'Vàng & Hàng hóa (XAU)', action);
        return;
      }
      if (assetTarget === 'coin') {
        handleExecuteTrade('coin', 'Coin (BTC/ETH/SOL)', action);
        return;
      }
      if (assetTarget === 'meme_coin') {
        handleExecuteTrade('memeCoin', 'Meme Coin (PEPE/DOGE/WIF)', action);
        return;
      }
      handleExecuteDecision(`${action} theo Lệnh Phân Tích`, summary, {
        tradeType: action,
        assetLabel: 'Tài sản tùy chỉnh',
      });
    },
    [handleExecuteTrade, handleExecuteDecision],
  );

  const handleProposeDerivatives = useCallback(
    async ({
      instrumentFocus,
      directive,
    }: {
      instrumentFocus: 'all' | 'options' | 'futures';
      directive: string;
    }) => {
      setDerivativeStatus('proposing');
      setDerivativeError(null);

      pushTrace({
        tick: stateRef.current.tick,
        source: `Phái Sinh · ${selectedProvider.toUpperCase()}`,
        category: 'swarm',
        message: `Yêu cầu Swarm thiết kế phòng hộ (${instrumentFocus.toUpperCase()})`,
        detail: directive,
      });

      try {
        const res = await fetch('/api/swarm/derivatives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: selectedProvider,
            model: selectedModel,
            instrumentFocus,
            directive,
            params: paramsRef.current,
            state: stateRef.current,
          }),
        });

        const payload = (await res.json()) as DerivativeSwarmResult & {
          error?: string;
          providers?: ProviderQuotaInfo[];
        };
        if (Array.isArray(payload.providers)) {
          setProviders(payload.providers);
        }
        if (!res.ok) {
          throw new Error(payload.error || `HTTP ${res.status}`);
        }

        setDerivativeResult(payload);
        setDerivativeStatus('idle');

        pushTrace({
          tick: stateRef.current.tick,
          source: `Phái Sinh · ${payload.portfolioRiskLevel}`,
          category: 'tool',
          message: `Swarm đề xuất ${payload.proposals.length} hợp đồng Options/Futures`,
          detail: `Tỷ lệ phòng hộ khuyến nghị ${payload.recommendedHedgeRatioPct}% · ${payload.riskAssessment}`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Lỗi kết nối máy chủ Phái sinh.';
        setDerivativeError(msg);
        setDerivativeStatus('error');
        pushTrace({
          tick: stateRef.current.tick,
          source: 'Phái Sinh · Lỗi',
          category: 'risk',
          message: 'Không thể tạo đề xuất Phái sinh',
          detail: msg,
        });
      }
    },
    [selectedProvider, selectedModel, pushTrace],
  );

  const handleExecuteDerivative = useCallback(
    (proposal: DerivativeContractProposal) => {
      const existing = paramsRef.current.activeDerivatives ?? [];
      if (existing.some((pos) => pos.ticker === proposal.ticker)) return;

      const newPosition: ActiveDerivativePosition = {
        ...proposal,
        openedAtTick: stateRef.current.tick,
        openedAtTime: nowTimeStr(),
        status: 'ACTIVE',
      };

      handleUpdateParams({
        activeDerivatives: [newPosition, ...existing],
        hedgingActive: true,
      });

      handleExecuteDecision(
        `Phái sinh ${proposal.ticker} (${proposal.instrumentLabel})`,
        `Notional ${formatUsd(proposal.notionalUsd)} · Phủ ${proposal.coveragePct}% ${proposal.underlyingLabel} · Giảm VaR -${proposal.estimatedVarReductionPct}% · ${proposal.strikeOrEntry}`,
        {
          tradeType: 'HEDGE',
          assetLabel: `${proposal.underlyingLabel} (${proposal.ticker})`,
        },
      );
    },
    [handleUpdateParams, handleExecuteDecision],
  );

  const handleExecuteAllDerivatives = useCallback(
    (proposals: DerivativeContractProposal[]) => {
      const existing = paramsRef.current.activeDerivatives ?? [];
      const toAdd = proposals.filter(
        (prop) => !existing.some((pos) => pos.ticker === prop.ticker),
      );
      if (toAdd.length === 0) return;

      const openedTime = nowTimeStr();
      const curTick = stateRef.current.tick;
      const newPositions: ActiveDerivativePosition[] = toAdd.map((prop) => ({
        ...prop,
        openedAtTick: curTick,
        openedAtTime: openedTime,
        status: 'ACTIVE',
      }));

      handleUpdateParams({
        activeDerivatives: [...newPositions, ...existing],
        hedgingActive: true,
      });

      const totalNotional = toAdd.reduce((sum, p) => sum + p.notionalUsd, 0);
      const totalVarDrop = toAdd.reduce((sum, p) => sum + p.estimatedVarReductionPct, 0);
      handleExecuteDecision(
        `Phái sinh: Mở ${toAdd.length} HĐ phòng hộ`,
        `Tổng quy mô ${formatUsd(totalNotional)} · Giảm VaR ước tính -${totalVarDrop.toFixed(1)}% · ${toAdd.map((p) => p.ticker).join(', ')}`,
        {
          tradeType: 'HEDGE',
          assetLabel: 'Danh mục Phái sinh Swarm',
        },
      );
    },
    [handleUpdateParams, handleExecuteDecision],
  );

  const handleCloseDerivative = useCallback(
    (contractId: string) => {
      const existing = paramsRef.current.activeDerivatives ?? [];
      const target = existing.find((p) => p.id === contractId);
      if (!target) return;

      const nextList = existing.filter((p) => p.id !== contractId);
      handleUpdateParams({
        activeDerivatives: nextList,
      });

      handleExecuteDecision(
        `Đóng Phái sinh ${target.ticker}`,
        `Tất toán hợp đồng ${target.instrumentLabel} (${formatUsd(target.notionalUsd)}) trên ${target.underlyingLabel}.`,
        {
          tradeType: 'HEDGE',
          assetLabel: `${target.underlyingLabel} (${target.ticker})`,
        },
      );
    },
    [handleUpdateParams, handleExecuteDecision],
  );

  const handleToggleSwarm = useCallback(() => {
    setSwarmOpen((open) => {
      if (open && swarmTab !== 'swarm') {
        setSwarmTab('swarm');
        setSelectedZone('overview');
        return true;
      }
      const next = !open;
      if (next) {
        setSwarmTab('swarm');
        setSelectedZone('overview');
      }
      return next;
    });
  }, [swarmTab]);

  const handleOpenAnalysis = useCallback(() => {
    setSwarmOpen((open) => {
      if (open && swarmTab === 'analysis') {
        return false;
      }
      setSwarmTab('analysis');
      setSelectedZone('overview');
      return true;
    });
  }, [swarmTab]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0B111A] text-slate-100">
      {/* Full-bleed Interactive 3D World with Swarm Drones */}
      <WorldCanvas
        simState={simState}
        selectedZone={selectedZone}
        showLabels={showLabels && !zenMode}
        onSelectZone={handleSelectZone}
        cameraResetTrigger={cameraResetTrigger}
        swarmStatus={swarmStatus}
        lastSwarmRun={lastSwarmRun}
      />

      {/* Compact Top Telemetry, Capitalization, History, Swarm & Trace Bar */}
      <TopBar
        state={simState}
        isRunning={isRunning}
        speed={speed}
        zenMode={zenMode}
        swarmOpen={swarmOpen}
        swarmTab={swarmTab}
        swarmStatus={swarmStatus}
        swarmAutopilot={swarmAutopilot}
        swarmCountdownSec={swarmCountdownSec}
        traceVisible={traceVisible}
        historyOpen={historyOpen}
        onToggleRunning={() => setIsRunning((r) => !r)}
        onCycleSpeed={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 5 : 1))}
        onToggleZen={() => setZenMode((z) => !z)}
        onToggleSwarm={handleToggleSwarm}
        onOpenAnalysis={handleOpenAnalysis}
        onToggleTrace={() => setTraceVisible((v) => !v)}
        onOpenHistory={() => setHistoryOpen((o) => !o)}
      />

      {/* On-Screen Real-Time Log Trace Overlay */}
      {!zenMode && (
        <LogTraceOverlay
          logs={traceLogs}
          visible={traceVisible}
          onClear={() => setTraceLogs([])}
          onTriggerUrgentSwarm={handleRunUrgentSwarm}
        />
      )}

      {/* Real Agent Swarm, Asset Analysis & Derivatives Panel */}
      {!zenMode && swarmOpen && (
        <SwarmPanel
          activeTab={swarmTab}
          onChangeTab={setSwarmTab}
          status={swarmStatus}
          error={swarmError}
          mission={swarmMission}
          autopilot={swarmAutopilot}
          countdownSec={swarmCountdownSec}
          autoApply={swarmAutoApply}
          lastRun={lastSwarmRun}
          analysisStatus={analysisStatus}
          analysisError={analysisError}
          analysisResult={analysisResult}
          onRunAnalysis={(payload) => void handleRunAnalysis(payload)}
          onApplyAnalysisTrade={handleApplyAnalysisTrade}
          derivativeStatus={derivativeStatus}
          derivativeError={derivativeError}
          derivativeResult={derivativeResult}
          activeDerivatives={params.activeDerivatives ?? []}
          currentVar95Pct={simState.var95Pct}
          currentCvar95Pct={simState.cvar95Pct}
          currentVolPct={simState.annualVolatilityPct}
          derivativeVaRReductionPct={simState.derivativeVaRReductionPct}
          onProposeDerivatives={(payload) => void handleProposeDerivatives(payload)}
          onExecuteDerivative={handleExecuteDerivative}
          onExecuteAllDerivatives={handleExecuteAllDerivatives}
          onCloseDerivative={handleCloseDerivative}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          providers={providers}
          quotaSettings={quotaSettings}
          testingProvider={testingProvider}
          testResult={testResult}
          onSelectProvider={handleSelectProvider}
          onSelectModel={setSelectedModel}
          onTestConnection={() => void handleTestConnection()}
          onUpdateQuota={(patch) => void handleUpdateQuota(patch)}
          onChangeMission={setSwarmMission}
          onToggleAutopilot={() => {
            setSwarmCountdownSec(Math.max(5, quotaSettings.minIntervalSec));
            setSwarmAutopilot((a) => !a);
          }}
          onToggleAutoApply={() => setSwarmAutoApply((a) => !a)}
          onRunSwarm={(m) => void handleRunSwarm(m)}
          onRunUrgentSwarm={handleRunUrgentSwarm}
          assetRiskBreaches={simState.assetRiskBreaches}
          onApplyPatch={(patch, summary) =>
            handleApplySwarmPatch(patch, summary, lastSwarmRun?.orchestrator.tradeDecision)
          }
          onSelectZone={handleSelectZone}
          onClose={() => setSwarmOpen(false)}
        />
      )}

      {/* Macro Global Capital Movement Overview Chart (when overview zone is selected) */}
      {!zenMode && !swarmOpen && selectedZone === 'overview' && (
        <MacroChartOverview state={simState} onSelectZone={handleSelectZone} />
      )}

      {/* Focused Model Inspector Drawer */}
      {!zenMode && !swarmOpen && selectedZone !== 'overview' && (
        <ZoneInspector
          zone={selectedZone}
          params={params}
          state={simState}
          onUpdateParams={handleUpdateParams}
          onExecuteDecision={handleExecuteDecision}
          onExecuteTrade={handleExecuteTrade}
          onInitCapital={handleInitCapital}
          onSelectZone={handleSelectZone}
          onOpenHistory={() => setHistoryOpen(true)}
          onClose={() => setSelectedZone('overview')}
        />
      )}

      {/* Trade & Decision History Modal with Simulated CSV Export */}
      <TradeHistoryModal
        open={historyOpen}
        entries={simState.decisionLog}
        currentTick={simState.tick}
        currentCapitalUsd={simState.capitalUsd}
        currentNav={simState.nav}
        onClose={() => setHistoryOpen(false)}
      />

      {/* Unified Collapsible Bottom Control Dock */}
      {!zenMode && (
        <ControlDock
          selectedZone={selectedZone}
          collapsed={dockCollapsed}
          showLabels={showLabels}
          onSelectZone={handleSelectZone}
          onToggleCollapse={() => setDockCollapsed((c) => !c)}
          onToggleLabels={() => setShowLabels((l) => !l)}
          onResetCamera={() => {
            setSelectedZone('overview');
            setCameraResetTrigger((c) => c + 1);
          }}
          onApplyScenario={handleApplyScenario}
        />
      )}
    </main>
  );
}
