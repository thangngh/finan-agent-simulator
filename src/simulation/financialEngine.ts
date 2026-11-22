import {
  AssetDecisionSignal,
  AssetRiskBreach,
  CorporateDocument,
  GlobalCapitalFlowPoint,
  LegalClauseFlag,
  MonteCarloPoint,
  SimulationParams,
  SimulationState,
  TradeAction,
  ZoneId,
  ZoneMetadata,
} from '../types/finance';

export function formatUsd(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
  return `${sign}$${abs.toFixed(0)}`;
}

export const ZONE_METADATA: Record<ZoneId, ZoneMetadata> = {
  overview: {
    id: 'overview',
    code: 'TỔNG QUAN',
    title: 'Toàn Cảnh Thế Giới Tài Chính',
    shortTitle: 'Tổng quan',
    subtitle: 'Hệ sinh thái phân tích tích hợp 8 phân khu',
    accentHex: '#F59E0B',
    worldPos: [0, 0, 0],
    cameraOffset: [22, 17, 24],
    labelHeight: 0,
    description:
      'Quan sát dòng chảy dữ liệu thời gian thực giữa 5 phòng ban phân tích, 2 khối pháp lý rủi ro và trung tâm quyết định đầu tư.',
  },
  center: {
    id: 'center',
    code: 'CENTER',
    title: 'Trung Tâm Quyết Định Đầu Tư',
    shortTitle: 'Center',
    subtitle: 'Tích hợp dữ liệu thời gian thực & điều phối vốn',
    accentHex: '#F59E0B',
    worldPos: [0, 0, 0],
    cameraOffset: [7.5, 6.2, 8.2],
    labelHeight: 6.1,
    description:
      'Tổng hợp tín hiệu dòng tiền, biến động chiến tranh, chu kỳ lịch sử, điều tiết vĩ mô, dự báo danh mục và rào chắn pháp lý để ra quyết định đầu tư.',
  },
  department1: {
    id: 'department1',
    code: 'DEPT 01',
    title: 'Phân Tích Dòng Tiền',
    shortTitle: 'Dòng tiền',
    subtitle: 'OCF · CapEx · Free Cash Flow',
    accentHex: '#10B981',
    worldPos: [0, 0, -11.5],
    cameraOffset: [5.5, 4.8, 6.5],
    labelHeight: 4.9,
    description:
      'Theo dõi lưu chuyển tiền tệ hoạt động, áp lực vốn lưu động (DSO), tỷ lệ tái đầu tư và sức khỏe thanh khoản doanh nghiệp.',
  },
  department2: {
    id: 'department2',
    code: 'DEPT 02',
    title: 'Biến Động Chiến Tranh',
    shortTitle: 'Chiến tranh',
    subtitle: 'Địa chính trị · Năng lượng · Chuỗi cung ứng',
    accentHex: '#EF4444',
    worldPos: [10.9, 0, -3.5],
    cameraOffset: [5.8, 4.6, 5.8],
    labelHeight: 4.8,
    description:
      'Đo lường xung đột địa chính trị, cú sốc giá dầu/hàng hóa, đứt gãy chuỗi cung ứng và hiệu quả phòng hộ.',
  },
  department3: {
    id: 'department3',
    code: 'DEPT 03',
    title: 'Lịch Sử Biến Động',
    shortTitle: 'Lịch sử',
    subtitle: 'Chu kỳ 2008 · 2020 · 2022 · Hiện tại',
    accentHex: '#38BDF8',
    worldPos: [6.8, 0, 9.3],
    cameraOffset: [5.4, 4.4, 6.2],
    labelHeight: 4.5,
    description:
      'Đối chiếu cấu trúc sụt giảm (drawdown) và tốc độ phục hồi với các cuộc khủng hoảng tài chính trong lịch sử.',
  },
  department4: {
    id: 'department4',
    code: 'DEPT 04',
    title: 'Chiến Lược Điều Tiết Kinh Tế',
    shortTitle: 'Điều tiết',
    subtitle: 'Đồ thị nhân quả vĩ mô trực quan',
    accentHex: '#818CF8',
    worldPos: [-6.8, 0, 9.3],
    cameraOffset: [-5.6, 4.6, 6.2],
    labelHeight: 5.0,
    description:
      'Mô hình hóa mối liên hệ phi tuyến giữa lãi suất, thanh khoản, lạm phát, tín dụng và tăng trưởng dưới dạng đồ thị trực quan.',
  },
  department5: {
    id: 'department5',
    code: 'DEPT 05',
    title: 'Quản Lý Rủi Ro Danh Mục',
    shortTitle: 'Rủi ro DM',
    subtitle: 'Monte Carlo · VaR 95% · CVaR',
    accentHex: '#2DD4BF',
    worldPos: [-10.9, 0, -3.5],
    cameraOffset: [-6.0, 4.5, 5.8],
    labelHeight: 4.7,
    description:
      'Dự báo phân phối lợi suất đa kịch bản, kiểm soát biến động mục tiêu và tự động kích hoạt ngưỡng cắt lỗ.',
  },
  lawer1: {
    id: 'lawer1',
    code: 'LAW-ER 01',
    title: 'Rủi Ro Pháp Lý Doanh Nghiệp',
    shortTitle: 'Pháp lý HS',
    subtitle: 'Thẩm định hồ sơ · Hợp đồng · Kiểm toán',
    accentHex: '#FBBF24',
    worldPos: [-7.8, 0, -9.8],
    cameraOffset: [-5.2, 4.3, 5.8],
    labelHeight: 4.6,
    description:
      'Phân tích điều khoản bất lợi từ giấy tờ công ty: ý kiến kiểm toán ngoại trừ, tranh chấp sở hữu trí tuệ, vi phạm ESG và nghĩa vụ nợ.',
  },
  lawer2: {
    id: 'lawer2',
    code: 'LAWER 02',
    title: 'Phân Tích Rủi Ro Đầu Tư',
    shortTitle: 'Rủi ro ĐT',
    subtitle: 'Covenants · Đối tác · Thanh khoản',
    accentHex: '#FB923C',
    worldPos: [7.8, 0, -9.8],
    cameraOffset: [5.4, 4.3, 5.8],
    labelHeight: 4.6,
    description:
      'Giám sát rủi ro tập trung danh mục, chất lượng đối tác, rủi ro thanh khoản và cảnh báo vi phạm hạn mức đầu tư.',
  },
};

export const CORPORATE_DOCUMENTS: CorporateDocument[] = [
  {
    id: 'doc_ma_tech',
    company: 'Tập đoàn Công nghệ Aetheris',
    title: 'Hồ sơ Sáp nhập & Thuyết minh BCTC Q3',
    docType: 'M&A & Kiểm toán',
    excerpt:
      'Ý kiến kiểm toán nhấn mạnh khoản phải thu khó đòi tăng 34%. Bên bán đang có vụ kiện tranh chấp bằng sáng chế tại tòa án thương mại và điều khoản phạt chậm bàn giao 8% giá trị hợp đồng nếu không đạt chấp thuận chống độc quyền.',
  },
  {
    id: 'doc_energy_infra',
    company: 'Tổng Công ty Năng lượng Hải Đăng',
    title: 'Báo cáo Phát hành Trái phiếu & Môi trường',
    docType: 'Trái phiếu & ESG',
    excerpt:
      'Tài sản đảm bảo là quyền khai thác dự án nhiệt điện đang chờ gia hạn giấy phép môi trường. Hợp đồng chứa điều khoản cross-default (vỡ nợ chéo) nếu tỷ lệ nợ/EBITDA vượt 4.2x và chưa hoàn tất nghĩa vụ bồi thường khí thải.',
  },
  {
    id: 'doc_clean_retail',
    company: 'Chuỗi Bán lẻ Chuẩn Mực Việt',
    title: 'Báo cáo Thường niên & Thuyết minh Pháp chế',
    docType: 'Kiểm toán sạch',
    excerpt:
      'Báo cáo tài chính được kiểm toán chấp nhận toàn phần, không ghi nhận tranh chấp lao động hoặc kiện tụng trọng yếu. Hệ thống quản trị tuân thủ tiêu chuẩn công bố thông tin minh bạch, hợp đồng thuê mặt bằng dài hạn ổn định.',
  },
];

export const HISTORICAL_REGIMES: Record<
  SimulationParams['selectedRegimeId'],
  {
    name: string;
    period: string;
    peakDropPct: number;
    recoveryMonths: number;
    curve: number[];
  }
> = {
  '2008_gfc': {
    name: 'Khủng hoảng Tài chính 2008',
    period: '2007–2009',
    peakDropPct: -46.2,
    recoveryMonths: 38,
    curve: [100, 96, 89, 82, 74, 63, 54, 58, 65, 72, 79, 86],
  },
  '2020_covid': {
    name: 'Cú sốc Đại dịch 2020',
    period: '02–12/2020',
    peakDropPct: -31.8,
    recoveryMonths: 6,
    curve: [100, 74, 68, 81, 89, 95, 102, 108, 113, 118, 122, 126],
  },
  '2022_inflation': {
    name: 'Thắt chặt Lãi suất 2022',
    period: '2022–2023',
    peakDropPct: -24.5,
    recoveryMonths: 17,
    curve: [100, 93, 88, 84, 79, 75.5, 78, 82, 85, 89, 94, 98],
  },
  current: {
    name: 'Quỹ đạo Mô phỏng Hiện tại',
    period: 'Thời gian thực',
    peakDropPct: -11.4,
    recoveryMonths: 7,
    curve: [100, 98, 95, 93, 96, 99, 101, 103, 105, 107, 109, 112],
  },
};

const LEGAL_RULES: Array<{
  patterns: RegExp;
  keyword: string;
  category: string;
  severity: 'high' | 'medium' | 'low';
  impactPoints: number;
  note: string;
}> = [
  {
    patterns: /kiện|tranh chấp|tòa án|litigation|lawsuit|dispute/i,
    keyword: 'Kiện tụng / Tranh chấp',
    category: 'Tố tụng',
    severity: 'high',
    impactPoints: 24,
    note: 'Nguy cơ phát sinh chi phí bồi thường hoặc đình chỉ tài sản.',
  },
  {
    patterns: /ngoại trừ|nhấn mạnh|khó đòi|qualified|doubt|receivable/i,
    keyword: 'Lưu ý kiểm toán / Nợ xấu',
    category: 'Kiểm toán',
    severity: 'high',
    impactPoints: 22,
    note: 'Chất lượng lợi nhuận và khả năng thu hồi tiền mặt bị suy giảm.',
  },
  {
    patterns: /vỡ nợ chéo|cross-default|phạt|penalty|default/i,
    keyword: 'Điều khoản Vỡ nợ chéo / Phạt',
    category: 'Nghĩa vụ nợ',
    severity: 'high',
    impactPoints: 20,
    note: 'Kích hoạt thu hồi nợ dây chuyền nếu vi phạm hệ số đòn bẩy.',
  },
  {
    patterns: /môi trường|khí thải|esg|giấy phép|chống độc quyền|antitrust/i,
    keyword: 'Giấy phép / Chống độc quyền / ESG',
    category: 'Pháp chế ngành',
    severity: 'medium',
    impactPoints: 14,
    note: 'Có thể làm chậm tiến độ thương vụ hoặc phát sinh chi phí tuân thủ.',
  },
  {
    patterns: /bằng sáng chế|sở hữu trí tuệ|ip|patent/i,
    keyword: 'Sở hữu trí tuệ (IP)',
    category: 'Tài sản vô hình',
    severity: 'medium',
    impactPoints: 12,
    note: 'Ảnh hưởng trực tiếp đến lợi thế cạnh tranh và doanh thu lõi.',
  },
];

export function analyzeCorporateLegalText(text: string): {
  legalRiskScore: number;
  flaggedClauses: LegalClauseFlag[];
} {
  const flags: LegalClauseFlag[] = [];
  let totalPoints = 8; // baseline compliance friction

  for (const rule of LEGAL_RULES) {
    if (rule.patterns.test(text)) {
      flags.push({
        keyword: rule.keyword,
        category: rule.category,
        severity: rule.severity,
        impactPoints: rule.impactPoints,
        note: rule.note,
      });
      totalPoints += rule.impactPoints;
    }
  }

  // Positive mitigators reduce score slightly
  if (/chấp nhận toàn phần|minh bạch|không ghi nhận tranh chấp/i.test(text)) {
    totalPoints = Math.max(6, totalPoints - 6);
  }

  return {
    legalRiskScore: Math.min(96, totalPoints),
    flaggedClauses: flags,
  };
}

export const INITIAL_PARAMS: SimulationParams = {
  initialCapitalUsd: 1_000_000,
  equityWeight: 38,
  bondWeight: 22,
  commodityWeight: 14,
  coinWeight: 12,
  memeCoinWeight: 4,
  cashWeight: 10,
  hedgingActive: false,

  reinvestmentRate: 38,
  receivableDays: 45,

  warEscalation: 28,
  commodityHedgePct: 40,

  selectedRegimeId: '2022_inflation',
  lookbackMonths: 36,

  policyRate: 4.5,
  liquidityInjection: 10,
  fiscalStimulus: 42,

  targetVolatility: 16,
  stopLossThreshold: 12,

  selectedDocId: CORPORATE_DOCUMENTS[0].id,
  customDocText: CORPORATE_DOCUMENTS[0].excerpt,

  maxDrawdownLimit: 18,
  maxConcentrationPct: 55,
  counterpartyTier: 'tier1',

  assetRiskThresholds: {
    equity: 24,
    bond: 12,
    commodity: 22,
    coin: 55,
    memeCoin: 98,
    cash: 5,
  },

  activeDerivatives: [],
};

export function normalizeWeights(params: SimulationParams): {
  eq: number;
  bd: number;
  cm: number;
  coin: number;
  meme: number;
  ca: number;
} {
  const sum =
    params.equityWeight +
    params.bondWeight +
    params.commodityWeight +
    params.coinWeight +
    params.memeCoinWeight +
    params.cashWeight;
  if (sum <= 0) {
    return { eq: 0.35, bd: 0.25, cm: 0.15, coin: 0.1, meme: 0.05, ca: 0.1 };
  }
  return {
    eq: params.equityWeight / sum,
    bd: params.bondWeight / sum,
    cm: params.commodityWeight / sum,
    coin: params.coinWeight / sum,
    meme: params.memeCoinWeight / sum,
    ca: params.cashWeight / sum,
  };
}

function buildMonteCarlo(
  nav: number,
  expectedReturnPct: number,
  volPct: number,
  stopLossPct: number,
): MonteCarloPoint[] {
  const points: MonteCarloPoint[] = [];
  const mu = expectedReturnPct / 100;
  const sigma = volPct / 100;

  for (let m = 0; m <= 24; m += 3) {
    const t = m / 12;
    const drift = (mu - 0.5 * sigma * sigma) * t;
    const spread = sigma * Math.sqrt(t);
    const p50 = nav * Math.exp(drift);
    const rawP10 = nav * Math.exp(drift - 1.2816 * spread);
    const stopFloor = nav * (1 - stopLossPct / 100);
    const p10 = Math.max(stopFloor, rawP10);
    const p90 = nav * Math.exp(drift + 1.2816 * spread);
    points.push({
      month: m,
      p10: Number(p10.toFixed(1)),
      p50: Number(p50.toFixed(1)),
      p90: Number(p90.toFixed(1)),
    });
  }
  return points;
}

export function computeSimulationStep(
  params: SimulationParams,
  prev: SimulationState | null,
  noiseSeed: number,
): SimulationState {
  const tick = prev ? prev.tick + 1 : 1;
  const weights = normalizeWeights(params);

  // --- Department 4: Macro Regulation Causal Graph ---
  const rateTightening = (params.policyRate - 4.0) * 1.1;
  const qeBoost = params.liquidityInjection * 0.045;
  const fiscalBoost = (params.fiscalStimulus - 40) * 0.03;

  const inflationPct = Math.max(
    1.2,
    Math.min(
      11.5,
      2.6 +
        qeBoost * 0.7 +
        fiscalBoost * 0.55 +
        params.warEscalation * 0.028 -
        rateTightening * 0.65,
    ),
  );
  const gdpGrowthPct = Math.max(
    -2.5,
    Math.min(
      7.5,
      3.4 + qeBoost * 0.45 + fiscalBoost * 0.6 - rateTightening * 0.55 - params.warEscalation * 0.018,
    ),
  );
  const creditSpreadBps = Math.round(
    Math.max(
      75,
      Math.min(
        560,
        145 + params.warEscalation * 1.85 + Math.max(0, params.policyRate - 4.2) * 32 - qeBoost * 18,
      ),
    ),
  );

  // --- Department 2: War & Geopolitical Volatility ---
  const geopoliticalRiskIndex = Math.round(
    Math.min(100, Math.max(5, params.warEscalation * 0.85 + (creditSpreadBps - 140) * 0.04)),
  );
  const oilShockPct = Number(
    (params.warEscalation * 0.52 * (1 - params.commodityHedgePct / 160)).toFixed(1),
  );
  const supplyChainStress = Math.round(
    Math.min(100, params.warEscalation * 0.78 + inflationPct * 3.1),
  );
  const warVolContribution = Number(
    ((params.warEscalation / 100) * 12.5 * (1 - params.commodityHedgePct / 180)).toFixed(2),
  );

  // --- Department 1: Cash Flow ---
  const macroDemandFactor = 1 + (gdpGrowthPct - 2.5) * 0.06 - params.warEscalation * 0.002;
  const operatingCashFlow = Number((260 * macroDemandFactor).toFixed(1));
  const capex = Number((operatingCashFlow * (params.reinvestmentRate / 100)).toFixed(1));
  const workingCapitalDrag = Number(((params.receivableDays - 30) * 1.15).toFixed(1));
  const freeCashFlow = Number((operatingCashFlow - capex - workingCapitalDrag).toFixed(1));
  const cashRunwayMonths =
    freeCashFlow >= 0
      ? 48
      : Math.max(3, Math.round(320 / Math.max(8, Math.abs(freeCashFlow))));

  // --- Law-er-1: Corporate Legal Document Risk ---
  const { legalRiskScore, flaggedClauses } = analyzeCorporateLegalText(params.customDocText);
  const legalHaircutPct = Number((legalRiskScore * 0.055).toFixed(2));

  // --- Lawer-2: Investment Risk & Covenants ---
  const maxSingleWeightPct = Math.round(
    Math.max(weights.eq, weights.bd, weights.cm, weights.coin, weights.meme, weights.ca) * 100,
  );
  const concentrationRiskScore = Math.round(
    Math.min(100, Math.max(12, (maxSingleWeightPct / params.maxConcentrationPct) * 62)),
  );
  const liquidityRiskScore = Math.round(
    Math.min(
      100,
      Math.max(
        10,
        (1 - weights.ca - weights.bd * 0.5) * 52 +
          weights.meme * 48 +
          params.warEscalation * 0.28 -
          params.liquidityInjection * 0.35,
      ),
    ),
  );
  const counterpartyBase =
    params.counterpartyTier === 'tier1'
      ? 18
      : params.counterpartyTier === 'mixed'
        ? 44
        : 72;
  const counterpartyRiskScore = Math.round(
    Math.min(100, counterpartyBase + (creditSpreadBps - 140) * 0.08 + weights.meme * 26),
  );
  const investmentRiskScore = Math.round(
    concentrationRiskScore * 0.35 + liquidityRiskScore * 0.35 + counterpartyRiskScore * 0.3,
  );

  // --- Department 5: Portfolio Risk & Forecast (including Coin, Meme Coin & Active Derivatives) ---
  const activeDerivatives = params.activeDerivatives ?? [];
  const rawDerivativeVarReduction = activeDerivatives.reduce(
    (acc, pos) => acc + Math.max(0, pos.estimatedVarReductionPct),
    0,
  );
  const derivativeVaRReductionPct = Number(Math.min(45, rawDerivativeVarReduction).toFixed(2));
  const derivativeHedgeMultiplier = 1 - derivativeVaRReductionPct / 100;

  const hedgeFactor = (params.hedgingActive ? 0.72 : 1.0) * derivativeHedgeMultiplier;
  const baseAssetVol =
    weights.eq * 18.5 +
    weights.bd * 6.5 +
    weights.cm * 15.0 +
    weights.coin * 46.0 +
    weights.meme * 94.0 +
    weights.ca * 0.8;
  const annualVolatilityPct = Number(
    Math.max(
      3.2,
      (baseAssetVol + warVolContribution * 0.85) * hedgeFactor,
    ).toFixed(2),
  );

  const coinDrift = 14.5 + qeBoost * 4.2 - rateTightening * 2.4 - params.warEscalation * 0.08;
  const memeDrift = 18.0 + qeBoost * 9.5 - rateTightening * 4.8 - params.warEscalation * 0.24;

  const rawExpectedReturn =
    weights.eq * (8.8 + gdpGrowthPct * 0.85 - rateTightening * 0.5) +
    weights.bd * (params.policyRate * 0.92 + 0.6) +
    weights.cm * (4.5 + oilShockPct * 0.18 + inflationPct * 0.45) +
    weights.coin * coinDrift +
    weights.meme * memeDrift +
    weights.ca * (params.policyRate * 0.78);

  const totalDerivativeCostUsd = activeDerivatives.reduce(
    (acc, pos) => acc + (pos.instrumentType.endsWith('option') ? pos.premiumOrMarginUsd : pos.premiumOrMarginUsd * 0.12),
    0,
  );
  const derivativeCarryCostPct =
    params.initialCapitalUsd > 0
      ? Math.min(4.5, (totalDerivativeCostUsd / params.initialCapitalUsd) * 100 * 0.65)
      : 0;
  const hedgeCost = (params.hedgingActive ? 1.35 : 0) + derivativeCarryCostPct;
  const fcfBonus = freeCashFlow > 60 ? 0.9 : freeCashFlow < 0 ? -1.8 : 0;
  const expectedReturnPct = Number(
    (rawExpectedReturn - legalHaircutPct * 0.55 - hedgeCost + fcfBonus).toFixed(2),
  );

  const var95Pct = Number((annualVolatilityPct * 1.645 * 0.45).toFixed(2));
  const cvar95Pct = Number((var95Pct * 1.28).toFixed(2));
  const riskFreeRate = params.policyRate * 0.85;
  const sharpeRatio = Number(
    ((expectedReturnPct - riskFreeRate) / Math.max(1.5, annualVolatilityPct)).toFixed(2),
  );

  // --- Real-Time NAV Step ---
  const prevNav = prev ? prev.nav : 1000;
  const dtYears = 1 / 252;
  const driftStep = (expectedReturnPct / 100) * dtYears;
  const shockWave =
    Math.sin(noiseSeed * 1.7 + tick * 0.45) * 0.65 +
    Math.cos(noiseSeed * 0.9 + tick * 0.23) * 0.35;
  const volStep = (annualVolatilityPct / 100) * Math.sqrt(dtYears) * shockWave * 1.65;
  const nextNav = Number(Math.max(420, prevNav * (1 + driftStep + volStep)).toFixed(2));

  const navHistory = prev ? [...prev.navHistory.slice(-47), nextNav] : [1000, nextNav];
  const peakNav = Math.max(...navHistory, 1000);
  const currentDrawdownPct = Number((((nextNav - peakNav) / peakNav) * 100).toFixed(2));

  // --- Covenant Breaches ---
  const covenantBreaches: string[] = [];
  if (maxSingleWeightPct > params.maxConcentrationPct) {
    covenantBreaches.push(
      `Vượt trần tập trung (${maxSingleWeightPct}% > ${params.maxConcentrationPct}%)`,
    );
  }
  if (Math.abs(currentDrawdownPct) > params.maxDrawdownLimit || var95Pct > params.maxDrawdownLimit) {
    covenantBreaches.push(
      `Rủi ro sụt giảm VaR (${var95Pct}%) chạm ngưỡng ${params.maxDrawdownLimit}%`,
    );
  }
  if (annualVolatilityPct > params.targetVolatility + 4) {
    covenantBreaches.push(
      `Biến động (${annualVolatilityPct}%) vượt mục tiêu ${params.targetVolatility}%`,
    );
  }
  if (legalRiskScore >= 55) {
    covenantBreaches.push(`Cảnh báo pháp lý hồ sơ (${legalRiskScore}/100)`);
  }

  // --- Department 3: Historical Regime Similarity ---
  const regime = HISTORICAL_REGIMES[params.selectedRegimeId];
  const regimeDiff = Math.abs(Math.abs(regime.peakDropPct) - var95Pct * 1.9);
  const historicalMatchSimilarity = Math.round(Math.max(24, Math.min(95, 92 - regimeDiff * 1.4)));

  // --- Center Conviction & Recommendation ---
  const convictionScore = Math.round(
    Math.max(
      8,
      Math.min(
        98,
        52 +
          sharpeRatio * 18 +
          (freeCashFlow > 40 ? 10 : -12) -
          legalRiskScore * 0.25 -
          investmentRiskScore * 0.18 -
          covenantBreaches.length * 8,
      ),
    ),
  );

  let recommendedAction: SimulationState['recommendedAction'] = 'Giữ cân bằng';
  if (covenantBreaches.length >= 2 || convictionScore < 35) {
    recommendedAction = 'Giảm rủi ro khẩn cấp';
  } else if (covenantBreaches.length === 1 || convictionScore < 52) {
    recommendedAction = 'Phòng thủ';
  } else if (convictionScore >= 70) {
    recommendedAction = 'Tăng tỷ trọng';
  }

  const monteCarloPaths = buildMonteCarlo(
    nextNav,
    expectedReturnPct,
    annualVolatilityPct,
    params.stopLossThreshold,
  );

  const liquidityNodeVal = Math.max(
    10,
    Math.min(95, Math.round(55 + params.liquidityInjection * 0.8 - (params.policyRate - 4) * 6)),
  );
  const economicNodes = [
    {
      id: 'rate',
      label: 'Lãi suất điều hành',
      value: Math.round(((params.policyRate - 1) / 8) * 100),
      displayValue: `${params.policyRate.toFixed(1)}%`,
      trend: params.policyRate > 5 ? ('up' as const) : ('down' as const),
    },
    {
      id: 'liquidity',
      label: 'Thanh khoản hệ thống',
      value: liquidityNodeVal,
      displayValue: `${params.liquidityInjection >= 0 ? '+' : ''}${params.liquidityInjection}B`,
      trend: params.liquidityInjection >= 0 ? ('up' as const) : ('down' as const),
    },
    {
      id: 'inflation',
      label: 'Áp lực lạm phát',
      value: Math.round(Math.min(100, (inflationPct / 10) * 100)),
      displayValue: `${inflationPct.toFixed(1)}%`,
      trend: inflationPct > 3.8 ? ('up' as const) : ('flat' as const),
    },
    {
      id: 'gdp',
      label: 'Tăng trưởng GDP',
      value: Math.round(Math.max(5, Math.min(100, ((gdpGrowthPct + 2) / 9) * 100))),
      displayValue: `${gdpGrowthPct.toFixed(1)}%`,
      trend: gdpGrowthPct > 2.8 ? ('up' as const) : ('down' as const),
    },
    {
      id: 'credit',
      label: 'Chênh lệch tín dụng',
      value: Math.round(Math.min(100, (creditSpreadBps / 500) * 100)),
      displayValue: `${creditSpreadBps} bps`,
      trend: creditSpreadBps > 240 ? ('up' as const) : ('down' as const),
    },
    {
      id: 'equity',
      label: 'Định giá thị trường',
      value: convictionScore,
      displayValue: `${expectedReturnPct.toFixed(1)}%`,
      trend: expectedReturnPct > 7 ? ('up' as const) : ('down' as const),
    },
  ];

  const snapshotMap: Record<Exclude<ZoneId, 'overview'>, { primary: number; secondary: number }> = {
    center: { primary: nextNav, secondary: convictionScore },
    department1: { primary: freeCashFlow, secondary: operatingCashFlow },
    department2: { primary: geopoliticalRiskIndex, secondary: oilShockPct },
    department3: { primary: Number(Math.abs(currentDrawdownPct).toFixed(2)), secondary: historicalMatchSimilarity },
    department4: { primary: Number(gdpGrowthPct.toFixed(2)), secondary: Number(inflationPct.toFixed(2)) },
    department5: { primary: annualVolatilityPct, secondary: var95Pct },
    lawer1: { primary: legalRiskScore, secondary: Number((legalHaircutPct * 10).toFixed(1)) },
    lawer2: { primary: investmentRiskScore, secondary: liquidityRiskScore },
  };

  const zoneIds = Object.keys(snapshotMap) as Exclude<ZoneId, 'overview'>[];
  const zoneHistory = {} as SimulationState['zoneHistory'];

  for (const zid of zoneIds) {
    const prevSeries = prev?.zoneHistory?.[zid];
    const cur = snapshotMap[zid];
    if (!prevSeries || prevSeries.length === 0) {
      // Seed initial 14-point historical window around initial values so trends are immediately visible
      const seeded = [];
      for (let i = 13; i >= 0; i--) {
        const wave = Math.sin(i * 0.65 + zid.length) * 0.045;
        const pVal =
          zid === 'center'
            ? Number((cur.primary * (1 - i * 0.0025 + wave * 0.35)).toFixed(2))
            : Number((cur.primary * (1 + wave)).toFixed(2));
        const sVal = Number((cur.secondary * (1 - wave * 0.8)).toFixed(2));
        seeded.push({
          tick: -i,
          label: i === 0 ? 'T+1' : `T-${i}`,
          primary: pVal,
          secondary: sVal,
        });
      }
      zoneHistory[zid] = seeded;
    } else {
      zoneHistory[zid] = [
        ...prevSeries.slice(-31),
        {
          tick,
          label: `T+${tick}`,
          primary: cur.primary,
          secondary: cur.secondary,
        },
      ];
    }
  }

  // --- Global Capital Movement Real-Time Stream ($B liquidity velocity) ---
  const flowWaveA = Math.sin(noiseSeed * 1.15 + tick * 0.42);
  const flowWaveB = Math.cos(noiseSeed * 0.85 + tick * 0.29);
  const tradFiFlow = Number(
    Math.max(
      18,
      95 +
        gdpGrowthPct * 14 +
        params.liquidityInjection * 0.85 -
        params.warEscalation * 0.38 +
        weights.eq * 45 +
        flowWaveA * 8.5,
    ).toFixed(1),
  );
  const cryptoFlow = Number(
    Math.max(
      6,
      36 +
        params.liquidityInjection * 0.72 -
        (params.policyRate - 4.0) * 8.5 -
        params.warEscalation * 0.22 +
        (weights.coin + weights.meme * 1.4) * 90 +
        flowWaveB * 6.4,
    ).toFixed(1),
  );
  const safeHavenFlow = Number(
    Math.max(
      24,
      78 +
        params.warEscalation * 0.75 +
        (params.policyRate - 3.0) * 9.2 +
        (weights.bd + weights.cm + weights.ca) * 52 +
        (params.hedgingActive ? 18 : 0) -
        flowWaveA * 4.2,
    ).toFixed(1),
  );
  const totalFlow = Number((tradFiFlow + cryptoFlow + safeHavenFlow).toFixed(1));

  let capitalFlowHistory: GlobalCapitalFlowPoint[];
  if (!prev?.capitalFlowHistory || prev.capitalFlowHistory.length === 0) {
    capitalFlowHistory = [];
    for (let i = 13; i >= 0; i--) {
      const w = Math.sin(i * 0.55 + 0.9) * 0.065;
      const w2 = Math.cos(i * 0.48 + 0.3) * 0.085;
      const tVal = Number((tradFiFlow * (1 - i * 0.004 + w)).toFixed(1));
      const cVal = Number((cryptoFlow * (1 - i * 0.006 + w2)).toFixed(1));
      const sVal = Number((safeHavenFlow * (1 + i * 0.002 - w * 0.6)).toFixed(1));
      capitalFlowHistory.push({
        tick: -i,
        label: i === 0 ? 'T+1' : `T-${i}`,
        tradFiFlow: tVal,
        cryptoFlow: cVal,
        safeHavenFlow: sVal,
        totalFlow: Number((tVal + cVal + sVal).toFixed(1)),
      });
    }
  } else {
    capitalFlowHistory = [
      ...prev.capitalFlowHistory.slice(-31),
      {
        tick,
        label: `T+${tick}`,
        tradFiFlow,
        cryptoFlow,
        safeHavenFlow,
        totalFlow,
      },
    ];
  }

  const capitalUsd = Number(((params.initialCapitalUsd * nextNav) / 1000).toFixed(0));
  const pnlUsd = Number((capitalUsd - params.initialCapitalUsd).toFixed(0));
  const pnlPct = Number((((nextNav - 1000) / 1000) * 100).toFixed(2));

  // Per-Asset Simulated Market Indices & Buy / Hold / Sell Signals
  const prevSignalMap = new Map(
    (prev?.assetSignals ?? []).map((item) => [item.id, item]),
  );

  const buildAssetSignal = (
    id: AssetDecisionSignal['id'],
    label: string,
    ticker: string,
    weightFrac: number,
    basePrice: number,
    driftPct: number,
    volPct: number,
    phase: number,
    action: TradeAction,
    reason: string,
  ): AssetDecisionSignal => {
    const prevItem = prevSignalMap.get(id);
    const prevPrice = prevItem ? prevItem.priceIndex : basePrice;
    const wave = Math.sin(noiseSeed * 1.4 + tick * 0.55 + phase) * 0.7 +
      Math.cos(noiseSeed * 0.8 + tick * 0.31 + phase) * 0.3;
    const stepPct =
      id === 'cash'
        ? 0
        : (driftPct / 100) * dtYears * 100 + (volPct / 100) * Math.sqrt(dtYears) * wave * 110;
    const nextPrice =
      id === 'cash'
        ? 1.0
        : Number(Math.max(basePrice * 0.25, prevPrice * (1 + stepPct / 100)).toFixed(id === 'memeCoin' ? 4 : 2));

    const assetCoverage = activeDerivatives
      .filter((d) => d.underlyingAsset === id)
      .reduce((sum, d) => sum + d.coveragePct, 0);
    const assetDerivativeFactor = 1 - Math.min(0.55, (assetCoverage / 100) * 0.55);

    const assetVolPct = Number(
      Math.max(
        0.4,
        (volPct +
          (id === 'cash' ? 0 : warVolContribution * 0.55) +
          Math.abs(stepPct) * 1.45) *
          (id === 'cash' ? 1 : (params.hedgingActive ? 0.72 : 1.0) * assetDerivativeFactor),
      ).toFixed(2),
    );
    const assetVar95Pct = Number((assetVolPct * 1.645 * 0.45).toFixed(2));
    const maxRiskThresholdPct =
      params.assetRiskThresholds?.[id] ?? INITIAL_PARAMS.assetRiskThresholds[id];
    const riskBreached =
      assetVolPct > maxRiskThresholdPct || assetVar95Pct > maxRiskThresholdPct;

    return {
      id,
      label,
      ticker,
      weightPct: Math.round(weightFrac * 100),
      marketValueUsd: Math.round(capitalUsd * weightFrac),
      priceIndex: nextPrice,
      tickChangePct: Number(stepPct.toFixed(2)),
      volatilityPct: assetVolPct,
      var95Pct: assetVar95Pct,
      maxRiskThresholdPct,
      riskBreached,
      action,
      reason,
    };
  };

  const eqAction: TradeAction =
    freeCashFlow > 45 && gdpGrowthPct > 2.2 && legalRiskScore < 55
      ? 'MUA'
      : legalRiskScore >= 65 || covenantBreaches.length >= 2
        ? 'BÁN'
        : 'GIỮ';

  const bdAction: TradeAction =
    params.policyRate >= 5.25 || geopoliticalRiskIndex >= 55
      ? 'MUA'
      : params.policyRate <= 2.75 && inflationPct >= 4.5
        ? 'BÁN'
        : 'GIỮ';

  const cmAction: TradeAction =
    geopoliticalRiskIndex >= 45 || inflationPct >= 4.0
      ? 'MUA'
      : geopoliticalRiskIndex < 15 && inflationPct < 2.2
        ? 'BÁN'
        : 'GIỮ';

  const coinAction: TradeAction =
    params.liquidityInjection >= 15 && params.policyRate <= 4.75 && geopoliticalRiskIndex < 55
      ? 'MUA'
      : params.liquidityInjection < -15 || geopoliticalRiskIndex >= 70 || covenantBreaches.length >= 2
        ? 'BÁN'
        : 'GIỮ';

  const memeAction: TradeAction =
    params.liquidityInjection >= 30 && params.warEscalation < 25 && weights.meme <= 0.1
      ? 'MUA'
      : params.warEscalation >= 45 || params.policyRate >= 5.5 || weights.meme > 0.14 || var95Pct > params.maxDrawdownLimit
        ? 'BÁN'
        : 'GIỮ';

  const cashAction: TradeAction =
    covenantBreaches.length >= 2 || geopoliticalRiskIndex >= 70
      ? 'MUA'
      : params.liquidityInjection >= 25 && convictionScore >= 70
        ? 'BÁN'
        : 'GIỮ';

  const assetSignals: AssetDecisionSignal[] = [
    buildAssetSignal(
      'equity',
      'Cổ phiếu',
      'EQX',
      weights.eq,
      100,
      8.8 + gdpGrowthPct * 0.85,
      18.5,
      0.3,
      eqAction,
      eqAction === 'MUA'
        ? 'FCF dương & GDP ổn định'
        : eqAction === 'BÁN'
          ? 'Rủi ro pháp lý / vi phạm hạn mức'
          : 'Chờ tín hiệu lợi nhuận rõ hơn',
    ),
    buildAssetSignal(
      'bond',
      'Trái phiếu',
      'BND',
      weights.bd,
      100,
      params.policyRate * 0.9,
      6.5,
      1.1,
      bdAction,
      bdAction === 'MUA'
        ? 'Lợi suất cao & nhu cầu trú ẩn'
        : bdAction === 'BÁN'
          ? 'Lạm phát bào mòn lợi tức thực'
          : 'Giữ cân bằng kỳ hạn',
    ),
    buildAssetSignal(
      'commodity',
      'Vàng & Hàng hóa',
      'GLD/OIL',
      weights.cm,
      100,
      4.5 + oilShockPct * 0.2,
      15.0,
      2.0,
      cmAction,
      cmAction === 'MUA'
        ? 'Phòng hộ địa chính trị & lạm phát'
        : cmAction === 'BÁN'
          ? 'Hạ nhiệt căng thẳng, chốt lời'
          : 'Duy trì vị thế phòng vệ',
    ),
    buildAssetSignal(
      'coin',
      'Coin (BTC/ETH)',
      'BTC/ETH',
      weights.coin,
      68400,
      coinDrift,
      46.0,
      2.8,
      coinAction,
      coinAction === 'MUA'
        ? 'Thanh khoản QE mở rộng hỗ trợ Crypto'
        : coinAction === 'BÁN'
          ? 'Thắt chặt tiền tệ / né rủi ro hệ thống'
          : 'Biến động cao, giữ tỷ trọng kiểm soát',
    ),
    buildAssetSignal(
      'memeCoin',
      'Meme Coin',
      'PEPE/DOGE',
      weights.meme,
      0.142,
      memeDrift,
      94.0,
      3.7,
      memeAction,
      memeAction === 'MUA'
        ? 'Dòng tiền đầu cơ hưng phấn (QE mạnh)'
        : memeAction === 'BÁN'
          ? 'Cắt giảm rủi ro đuôi (Tail Risk)'
          : 'Theo dõi sát động lượng thanh khoản',
    ),
    buildAssetSignal(
      'cash',
      'Tiền mặt USD',
      'USDC/USD',
      weights.ca,
      1.0,
      params.policyRate * 0.78,
      0.5,
      0,
      cashAction,
      cashAction === 'MUA'
        ? 'Tăng đệm thanh khoản phòng thủ'
        : cashAction === 'BÁN'
          ? 'Giải ngân sang tài sản sinh lời'
          : 'Duy trì dự phòng thanh khoản',
    ),
  ];

  const overallTradeAction: TradeAction =
    recommendedAction === 'Tăng tỷ trọng'
      ? 'MUA'
      : recommendedAction === 'Giảm rủi ro khẩn cấp'
        ? 'BÁN'
        : 'GIỮ';

  const assetRiskBreaches: AssetRiskBreach[] = assetSignals
    .filter((sig) => sig.riskBreached)
    .map((sig) => {
      const volOver = sig.volatilityPct > sig.maxRiskThresholdPct;
      const varOver = sig.var95Pct > sig.maxRiskThresholdPct;
      const triggerMetric: AssetRiskBreach['triggerMetric'] =
        volOver && varOver ? 'Biến động & VaR' : varOver ? 'VaR 95%' : 'Biến động';
      const peakVal = Math.max(sig.volatilityPct, sig.var95Pct);
      return {
        assetId: sig.id,
        label: sig.label,
        ticker: sig.ticker,
        weightPct: sig.weightPct,
        volatilityPct: sig.volatilityPct,
        var95Pct: sig.var95Pct,
        thresholdPct: sig.maxRiskThresholdPct,
        triggerMetric,
        excessPct: Number((peakVal - sig.maxRiskThresholdPct).toFixed(2)),
      };
    });

  return {
    tick,
    nav: nextNav,
    capitalUsd,
    pnlUsd,
    pnlPct,
    navHistory,
    expectedReturnPct,
    annualVolatilityPct,
    convictionScore,
    assetSignals,
    overallTradeAction,
    operatingCashFlow,
    capex,
    workingCapitalDrag,
    freeCashFlow,
    cashRunwayMonths,
    geopoliticalRiskIndex,
    oilShockPct,
    supplyChainStress,
    warVolContribution,
    currentDrawdownPct,
    historicalMatchSimilarity,
    inflationPct,
    gdpGrowthPct,
    creditSpreadBps,
    economicNodes,
    var95Pct,
    cvar95Pct,
    sharpeRatio,
    monteCarloPaths,
    legalRiskScore,
    legalHaircutPct,
    flaggedClauses,
    investmentRiskScore,
    liquidityRiskScore,
    concentrationRiskScore,
    counterpartyRiskScore,
    covenantBreaches,
    assetRiskBreaches,
    derivativeVaRReductionPct,
    recommendedAction,
    decisionLog: prev?.decisionLog ?? [
      {
        id: 'init-1',
        tick: 0,
        timestamp: new Date().toTimeString().slice(0, 8),
        action: 'Khởi tạo thế giới tài chính',
        tradeType: 'INIT',
        assetLabel: 'Danh mục 6 tài sản',
        capitalUsd: params.initialCapitalUsd,
        nav: 1000,
        detail: `Vốn hóa giả lập ${formatUsd(params.initialCapitalUsd)} · 6 lớp tài sản gồm Coin & Meme Coin.`,
        deltaReturnPct: 0,
      },
    ],
    zoneHistory,
    capitalFlowHistory,
  };
}
