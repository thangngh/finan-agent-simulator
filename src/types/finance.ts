export type ZoneId =
  | 'overview'
  | 'center'
  | 'department1'
  | 'department2'
  | 'department3'
  | 'department4'
  | 'department5'
  | 'lawer1'
  | 'lawer2';

export interface ZoneMetadata {
  id: ZoneId;
  code: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  accentHex: string;
  worldPos: [number, number, number];
  cameraOffset: [number, number, number];
  labelHeight: number;
  description: string;
}

export interface CorporateDocument {
  id: string;
  company: string;
  title: string;
  docType: string;
  excerpt: string;
}

export interface LegalClauseFlag {
  keyword: string;
  category: string;
  severity: 'high' | 'medium' | 'low';
  impactPoints: number;
  note: string;
}

export type DecisionCategoryTag = TradeAction | 'SWARM' | 'SCENARIO' | 'INIT' | 'HEDGE';

export interface DecisionLogEntry {
  id: string;
  tick: number;
  timestamp?: string;
  action: string;
  tradeType?: DecisionCategoryTag;
  assetLabel?: string;
  capitalUsd?: number;
  nav?: number;
  detail: string;
  deltaReturnPct: number;
}

export type TradeAction = 'MUA' | 'GIỮ' | 'BÁN';

export type AssetClassId = 'equity' | 'bond' | 'commodity' | 'coin' | 'memeCoin' | 'cash';

export interface AssetDecisionSignal {
  id: AssetClassId;
  label: string;
  ticker: string;
  weightPct: number;
  marketValueUsd: number;
  priceIndex: number;
  tickChangePct: number;
  volatilityPct: number;
  var95Pct: number;
  maxRiskThresholdPct: number;
  riskBreached: boolean;
  action: TradeAction;
  reason: string;
}

export interface AssetRiskBreach {
  assetId: AssetClassId;
  label: string;
  ticker: string;
  weightPct: number;
  volatilityPct: number;
  var95Pct: number;
  thresholdPct: number;
  triggerMetric: 'Biến động' | 'VaR 95%' | 'Biến động & VaR';
  excessPct: number;
}

export interface TraceLogEntry {
  id: string;
  tick: number;
  timestamp: string;
  source: string;
  category: 'init' | 'trade' | 'swarm' | 'tool' | 'dialogue' | 'risk' | 'system';
  severity?: 'critical' | 'warning' | 'normal';
  tradeAction?: TradeAction;
  message: string;
  detail?: string;
}

export interface SimulationParams {
  // Initial Simulated Capitalization (USD)
  initialCapitalUsd: number;

  // Center: Portfolio Allocation (normalized to 100%)
  equityWeight: number; // 0-100
  bondWeight: number; // 0-100
  commodityWeight: number; // 0-100
  coinWeight: number; // 0-100 (BTC, ETH, SOL)
  memeCoinWeight: number; // 0-100 (DOGE, PEPE, WIF)
  cashWeight: number; // 0-100
  hedgingActive: boolean;

  // Department 1: Cash Flow
  reinvestmentRate: number; // % (10 - 80)
  receivableDays: number; // DSO days (20 - 110)

  // Department 2: War & Geopolitical Volatility
  warEscalation: number; // 0 - 100
  commodityHedgePct: number; // 0 - 100

  // Department 3: Historical Volatility
  selectedRegimeId: '2008_gfc' | '2020_covid' | '2022_inflation' | 'current';
  lookbackMonths: number; // 12 - 60

  // Department 4: Macro Regulation Strategy
  policyRate: number; // % (1.0 - 9.0)
  liquidityInjection: number; // -50 to +50 (QT to QE)
  fiscalStimulus: number; // 0 - 100

  // Department 5: Portfolio Risk & Forecast
  targetVolatility: number; // % (6 - 45)
  stopLossThreshold: number; // % (5 - 25)

  // Law-er-1: Corporate Legal Documents
  selectedDocId: string;
  customDocText: string;

  // Lawer-2: Investment Risk Covenants
  maxDrawdownLimit: number; // % (8 - 30)
  maxConcentrationPct: number; // % (25 - 80)
  counterpartyTier: 'tier1' | 'mixed' | 'emerging';

  // Per-Asset Class Maximum Risk Thresholds (% for VaR / Volatility)
  assetRiskThresholds: Record<AssetClassId, number>;

  // Active Derivative Hedging Contracts (Options & Futures)
  activeDerivatives: ActiveDerivativePosition[];
}

export interface EconomicNodeState {
  id: string;
  label: string;
  value: number; // 0 - 100 normalized
  displayValue: string;
  trend: 'up' | 'down' | 'flat';
}

export interface MonteCarloPoint {
  month: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface ZoneTrendPoint {
  tick: number;
  label: string;
  primary: number;
  secondary: number;
}

export interface GlobalCapitalFlowPoint {
  tick: number;
  label: string;
  tradFiFlow: number;
  cryptoFlow: number;
  safeHavenFlow: number;
  totalFlow: number;
}

export interface SimulationState {
  tick: number;
  nav: number; // Base 1000
  capitalUsd: number; // Live Portfolio Capitalization in USD
  pnlUsd: number; // Live PnL vs initialCapitalUsd
  pnlPct: number;
  navHistory: number[]; // Last 48 ticks
  expectedReturnPct: number;
  annualVolatilityPct: number;
  convictionScore: number; // 0 - 100

  // Per-Asset Prices, Values & Buy/Hold/Sell Decisions
  assetSignals: AssetDecisionSignal[];
  overallTradeAction: TradeAction;

  // Dept 1: Cash Flow
  operatingCashFlow: number; // $M
  capex: number; // $M
  workingCapitalDrag: number; // $M
  freeCashFlow: number; // $M
  cashRunwayMonths: number;

  // Dept 2: War Volatility
  geopoliticalRiskIndex: number; // 0 - 100
  oilShockPct: number;
  supplyChainStress: number; // 0 - 100
  warVolContribution: number; // %

  // Dept 3: Historical Comparison
  currentDrawdownPct: number;
  historicalMatchSimilarity: number; // %

  // Dept 4: Regulation Economic Graph
  inflationPct: number;
  gdpGrowthPct: number;
  creditSpreadBps: number;
  economicNodes: EconomicNodeState[];

  // Dept 5: Portfolio Risk & Forecast
  var95Pct: number;
  cvar95Pct: number;
  sharpeRatio: number;
  monteCarloPaths: MonteCarloPoint[];

  // Law-er-1: Legal Document Risk
  legalRiskScore: number; // 0 - 100
  legalHaircutPct: number;
  flaggedClauses: LegalClauseFlag[];

  // Lawer-2: Investment Risk
  investmentRiskScore: number; // 0 - 100
  liquidityRiskScore: number;
  concentrationRiskScore: number;
  counterpartyRiskScore: number;
  covenantBreaches: string[];
  assetRiskBreaches: AssetRiskBreach[];
  derivativeVaRReductionPct: number;

  // Center Decision Output
  recommendedAction: 'Tăng tỷ trọng' | 'Giữ cân bằng' | 'Phòng thủ' | 'Giảm rủi ro khẩn cấp';
  decisionLog: DecisionLogEntry[];

  // Per-Zone Historical Financial Trends (for Recharts mini-charts)
  zoneHistory: Record<Exclude<ZoneId, 'overview'>, ZoneTrendPoint[]>;

  // Global Capital Movement Real-Time Stream (for MacroChartOverview)
  capitalFlowHistory: GlobalCapitalFlowPoint[];
}

export type SwarmStatus = 'idle' | 'deliberating' | 'error';

export type SwarmAgentStance = 'bullish' | 'neutral' | 'cautious' | 'veto';

export interface ToolInvocationRecord {
  toolName: string;
  argsSummary: string;
  resultSummary: string;
}

export interface SwarmDialogueTurn {
  id: string;
  round: 1 | 2 | 3;
  fromId: ZoneId;
  fromName: string;
  toId: ZoneId;
  toName: string;
  message: string;
  stance?: SwarmAgentStance;
}

export interface SpecialistAgentReport {
  agentId: Exclude<ZoneId, 'overview' | 'center'>;
  agentName: string;
  roleTitle: string;
  stance: SwarmAgentStance;
  confidence: number;
  summary: string;
  messageToCenter: string;
  toolsCalled?: ToolInvocationRecord[];
}

export type LlmProviderId = 'gemini' | 'openai' | 'anthropic' | 'openrouter';

export interface ProviderQuotaInfo {
  provider: LlmProviderId;
  label: string;
  envVarName: string;
  configured: boolean;
  defaultModel: string;
  availableModels: string[];
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  lastTestedAt?: string;
  lastTestOk?: boolean;
  lastLatencyMs?: number;
  lastMessage?: string;
}

export interface QuotaSettings {
  minIntervalSec: number;
  autoFallbackOn429: boolean;
}

export interface SwarmRunResult {
  runId: string;
  provider?: LlmProviderId;
  model: string;
  latencyMs: number;
  mission: string;
  specialistReports: SpecialistAgentReport[];
  dialogueThread: SwarmDialogueTurn[];
  orchestrator: {
    consensusStance: string;
    tradeDecision: TradeAction;
    targetAsset: string;
    confidence: number;
    executiveSummary: string;
    conflictResolution: string;
    paramsPatch: Partial<SimulationParams>;
  };
}

export type AnalysisAssetTarget = 'gold' | 'gold_forex' | 'coin' | 'meme_coin' | 'custom';

export interface AssetAnalysisResult {
  runId: string;
  provider: LlmProviderId;
  model: string;
  latencyMs: number;
  assetTarget: AnalysisAssetTarget;
  assetLabel: string;
  horizonMinutes: number;
  query: string;
  direction: 'TĂNG' | 'GIẢM' | 'ĐI NGANG';
  confidencePct: number;
  expectedMovePct: number;
  entryZone: string;
  targetPrice: string;
  stopLossPrice: string;
  summary: string;
  drivers: string[];
  forexCorrelationNote?: string;
  riskWarning: string;
  recommendedAction: TradeAction;
}

export type DerivativeInstrumentType =
  | 'put_option'
  | 'call_option'
  | 'short_futures'
  | 'long_futures';

export interface DerivativeContractProposal {
  id: string;
  instrumentType: DerivativeInstrumentType;
  instrumentLabel: string;
  underlyingAsset: AssetClassId;
  underlyingLabel: string;
  ticker: string;
  side: 'MUA_BẢO_HIỂM' | 'BÁN_PHÒNG_HỘ';
  notionalUsd: number;
  coveragePct: number;
  strikeOrEntry: string;
  expiryDays: number;
  leverage: number;
  premiumOrMarginUsd: number;
  estimatedVarReductionPct: number;
  proposingAgent: string;
  rationale: string;
  riskNote: string;
}

export interface ActiveDerivativePosition extends DerivativeContractProposal {
  openedAtTick: number;
  openedAtTime: string;
  status: 'ACTIVE';
}

export interface DerivativeSwarmResult {
  runId: string;
  provider: LlmProviderId;
  model: string;
  latencyMs: number;
  riskAssessment: string;
  portfolioRiskLevel: 'THẤP' | 'TRUNG BÌNH' | 'CAO' | 'KHẨN CẤP';
  recommendedHedgeRatioPct: number;
  proposals: DerivativeContractProposal[];
}
