import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Content,
  FunctionDeclaration,
  GoogleGenAI,
  Part,
  ThinkingLevel,
  Type,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

type LlmProviderId = 'gemini' | 'openai' | 'anthropic' | 'openrouter';

type SpecialistId =
  | 'department1'
  | 'department2'
  | 'department3'
  | 'department4'
  | 'department5'
  | 'lawer1'
  | 'lawer2';

interface AgentDefinition {
  id: SpecialistId;
  agentName: string;
  roleTitle: string;
  mandate: string;
}

interface ToolInvocationRecord {
  toolName: string;
  argsSummary: string;
  resultSummary: string;
}

interface SwarmDialogueTurn {
  id: string;
  round: 1 | 2 | 3;
  fromId: SpecialistId | 'center' | 'overview';
  fromName: string;
  toId: SpecialistId | 'center' | 'overview';
  toName: string;
  message: string;
  stance?: 'bullish' | 'neutral' | 'cautious' | 'veto';
}

interface ProviderRuntimeState {
  provider: LlmProviderId;
  label: string;
  envVarName: string;
  defaultModel: string;
  availableModels: string[];
  dailyLimit: number;
  usedToday: number;
  lastResetDay: string;
  lastCallAtMs: number;
  lastTestedAt?: string;
  lastTestOk?: boolean;
  lastLatencyMs?: number;
  lastMessage?: string;
}

interface ParsedSwarmPayload {
  specialistReports?: Array<{
    agentId?: string;
    stance?: string;
    confidence?: number;
    summary?: string;
    messageToCenter?: string;
  }>;
  dialogueTurns?: Array<{
    round?: number;
    fromId?: string;
    toId?: string;
    message?: string;
    stance?: string;
  }>;
  orchestrator?: {
    consensusStance?: string;
    tradeDecision?: string;
    targetAsset?: string;
    confidence?: number;
    executiveSummary?: string;
    conflictResolution?: string;
    paramsPatch?: Record<string, unknown>;
  };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

const PROVIDER_REGISTRY: Record<LlmProviderId, ProviderRuntimeState> = {
  gemini: {
    provider: 'gemini',
    label: 'Google Gemini',
    envVarName: 'GEMINI_API_KEY',
    defaultModel: DEFAULT_GEMINI_MODEL,
    availableModels: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
    dailyLimit: 20,
    usedToday: 0,
    lastResetDay: todayKey(),
    lastCallAtMs: 0,
  },
  openai: {
    provider: 'openai',
    label: 'OpenAI',
    envVarName: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
    availableModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    dailyLimit: 200,
    usedToday: 0,
    lastResetDay: todayKey(),
    lastCallAtMs: 0,
  },
  anthropic: {
    provider: 'anthropic',
    label: 'Anthropic Claude',
    envVarName: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-3-5-haiku-latest',
    availableModels: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest'],
    dailyLimit: 200,
    usedToday: 0,
    lastResetDay: todayKey(),
    lastCallAtMs: 0,
  },
  openrouter: {
    provider: 'openrouter',
    label: 'OpenRouter',
    envVarName: 'OPENROUTER_API_KEY',
    defaultModel: 'openai/gpt-4o-mini',
    availableModels: [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.5-flash',
    ],
    dailyLimit: 200,
    usedToday: 0,
    lastResetDay: todayKey(),
    lastCallAtMs: 0,
  },
};

const quotaSettings = {
  minIntervalSec: 5,
  autoFallbackOn429: true,
};

function getProviderApiKey(provider: LlmProviderId): string | null {
  const envName = PROVIDER_REGISTRY[provider].envVarName;
  const val = process.env[envName]?.trim();
  if (!val || val === 'MY_GEMINI_API_KEY') return null;
  return val;
}

function rollDailyQuotaIfNeeded(entry: ProviderRuntimeState) {
  const curDay = todayKey();
  if (entry.lastResetDay !== curDay) {
    entry.usedToday = 0;
    entry.lastResetDay = curDay;
  }
}

function getAllProviderStatus() {
  return (Object.keys(PROVIDER_REGISTRY) as LlmProviderId[]).map((pid) => {
    const entry = PROVIDER_REGISTRY[pid];
    rollDailyQuotaIfNeeded(entry);
    const configured = Boolean(getProviderApiKey(pid));
    return {
      provider: entry.provider,
      label: entry.label,
      envVarName: entry.envVarName,
      configured,
      defaultModel: entry.defaultModel,
      availableModels: entry.availableModels,
      dailyLimit: entry.dailyLimit,
      usedToday: entry.usedToday,
      remainingToday: Math.max(0, entry.dailyLimit - entry.usedToday),
      lastTestedAt: entry.lastTestedAt,
      lastTestOk: entry.lastTestOk,
      lastLatencyMs: entry.lastLatencyMs,
      lastMessage: entry.lastMessage,
    };
  });
}

// --- Real Function Calling Tool Declarations for All 7 Departments ---
const calcCashFlowStressTool: FunctionDeclaration = {
  name: 'calcCashFlowStress',
  description:
    'Mô phỏng áp lực dòng tiền doanh nghiệp (Department 1): kiểm tra Free Cash Flow và Cash Runway khi thay đổi DSO hoặc tỷ lệ tái đầu tư CapEx.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      dsoDeltaDays: {
        type: Type.NUMBER,
        description: 'Mức thay đổi giả định của số ngày thu tiền DSO (ví dụ +15 hoặc -10).',
      },
      capexRatePct: {
        type: Type.NUMBER,
        description: 'Tỷ lệ tái đầu tư CapEx/OCF cần kiểm tra (10 đến 80).',
      },
    },
    required: ['dsoDeltaDays', 'capexRatePct'],
  },
};

const calcGeopoliticalShockTool: FunctionDeclaration = {
  name: 'calcGeopoliticalShock',
  description:
    'Tính toán tác động cú sốc chiến tranh lên giá dầu, chuỗi cung ứng và tỷ lệ phòng hộ hàng hóa/vàng tối ưu (Department 2).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      escalationShock: {
        type: Type.NUMBER,
        description: 'Mức leo thang xung đột giả định từ 0 đến 100.',
      },
      hedgeRatioPct: {
        type: Type.NUMBER,
        description: 'Tỷ lệ phòng hộ Hàng hóa / Vàng thử nghiệm từ 0 đến 100.',
      },
    },
    required: ['escalationShock', 'hedgeRatioPct'],
  },
};

const compareHistoricalRegimeTool: FunctionDeclaration = {
  name: 'compareHistoricalRegime',
  description:
    'Đối chiếu biến động và drawdown hiện tại với các cuộc khủng hoảng lịch sử (Department 3).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      regimeId: {
        type: Type.STRING,
        description: 'Mã chu kỳ lịch sử: 2008_gfc, 2020_covid, hoặc 2022_inflation.',
      },
    },
    required: ['regimeId'],
  },
};

const simulateMacroPolicyTool: FunctionDeclaration = {
  name: 'simulateMacroPolicy',
  description:
    'Chạy mô phỏng đồ thị nhân quả vĩ mô khi điều chỉnh lãi suất điều hành và bơm/hút thanh khoản QE/QT (Department 4).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      targetPolicyRate: {
        type: Type.NUMBER,
        description: 'Lãi suất điều hành mục tiêu (1.0 đến 9.0%).',
      },
      liquidityDeltaB: {
        type: Type.NUMBER,
        description: 'Mức bơm/hút thanh khoản QE/QT (-50 đến +50 tỷ USD).',
      },
    },
    required: ['targetPolicyRate', 'liquidityDeltaB'],
  },
};

const calcPortfolioTailRiskTool: FunctionDeclaration = {
  name: 'calcPortfolioTailRisk',
  description:
    'Tính VaR 95%, CVaR đuôi và rủi ro biến động khi điều chỉnh tỷ trọng Coin, Meme Coin và trạng thái phòng hộ (Department 5).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      coinWeightPct: {
        type: Type.NUMBER,
        description: 'Tỷ trọng Coin (BTC/ETH/SOL) thử nghiệm 0..45.',
      },
      memeCoinWeightPct: {
        type: Type.NUMBER,
        description: 'Tỷ trọng Meme Coin (DOGE/PEPE) thử nghiệm 0..25.',
      },
      enableHedge: {
        type: Type.BOOLEAN,
        description: 'Bật hay tắt phòng hộ biến động danh mục.',
      },
    },
    required: ['coinWeightPct', 'memeCoinWeightPct', 'enableHedge'],
  },
};

const scanLegalClausesTool: FunctionDeclaration = {
  name: 'scanLegalClauses',
  description:
    'Quét chuyên sâu điều khoản rủi ro pháp lý, kiện tụng, kiểm toán ngoại trừ và vỡ nợ chéo từ văn bản hồ sơ doanh nghiệp (Law-er-1).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      focusArea: {
        type: Type.STRING,
        description: 'Trọng tâm kiểm tra: litigation, audit, covenant, hoặc all.',
      },
    },
    required: ['focusArea'],
  },
};

const checkCovenantsAndLiquidityTool: FunctionDeclaration = {
  name: 'checkCovenantsAndLiquidity',
  description:
    'Kiểm tra vi phạm hạn mức đầu tư (Covenants), rủi ro tập trung tài sản và thanh khoản thị trường gồm Coin & Meme Coin (Lawer-2).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      stressMultiplier: {
        type: Type.NUMBER,
        description: 'Hệ số căng thẳng thanh khoản từ 1.0 (bình thường) đến 2.0 (khủng hoảng).',
      },
    },
    required: ['stressMultiplier'],
  },
};

const ALL_DEPARTMENT_TOOLS: FunctionDeclaration[] = [
  calcCashFlowStressTool,
  calcGeopoliticalShockTool,
  compareHistoricalRegimeTool,
  simulateMacroPolicyTool,
  calcPortfolioTailRiskTool,
  scanLegalClausesTool,
  checkCovenantsAndLiquidityTool,
];

const TOOL_OWNER_AGENT: Record<string, SpecialistId> = {
  calcCashFlowStress: 'department1',
  calcGeopoliticalShock: 'department2',
  compareHistoricalRegime: 'department3',
  simulateMacroPolicy: 'department4',
  calcPortfolioTailRisk: 'department5',
  scanLegalClauses: 'lawer1',
  checkCovenantsAndLiquidity: 'lawer2',
};

const SPECIALIST_AGENTS: AgentDefinition[] = [
  {
    id: 'department1',
    agentName: 'CashFlow-01',
    roleTitle: 'Agent Phân tích Dòng tiền',
    mandate: 'Đánh giá OCF, CapEx, DSO, Free Cash Flow và Cash Runway.',
  },
  {
    id: 'department2',
    agentName: 'GeoWar-02',
    roleTitle: 'Agent Biến động Chiến tranh',
    mandate: 'Phân tích chỉ số rủi ro địa chính trị, cú sốc năng lượng và phòng hộ hàng hóa/vàng.',
  },
  {
    id: 'department3',
    agentName: 'HistCycle-03',
    roleTitle: 'Agent Lịch sử Biến động',
    mandate: 'Đối chiếu mức sụt giảm hiện tại với các chu kỳ 2008, 2020, 2022.',
  },
  {
    id: 'department4',
    agentName: 'MacroGraph-04',
    roleTitle: 'Agent Chiến lược Điều tiết Kinh tế',
    mandate: 'Phân tích đồ thị nhân quả vĩ mô giữa lãi suất, QE/QT, lạm phát và GDP.',
  },
  {
    id: 'department5',
    agentName: 'RiskMC-05',
    roleTitle: 'Agent Quản lý Rủi ro Danh mục',
    mandate: 'Kiểm tra Monte Carlo, VaR 95%, CVaR và tỷ trọng Coin/Meme Coin.',
  },
  {
    id: 'lawer1',
    agentName: 'LegalDoc-06',
    roleTitle: 'Agent Rủi ro Pháp lý Doanh nghiệp',
    mandate: 'Thẩm định điều khoản bất lợi từ giấy tờ công ty.',
  },
  {
    id: 'lawer2',
    agentName: 'Covenant-07',
    roleTitle: 'Agent Rủi ro Đầu tư & Hạn mức',
    mandate: 'Giám sát rủi ro tập trung, thanh khoản (gồm Coin/Meme Coin) và vi phạm Covenants.',
  },
];

// JSON-schema representation compatible with OpenAI/OpenRouter/Anthropic tools
function toStandardToolSchema(decl: FunctionDeclaration) {
  const props: Record<string, { type: string; description?: string }> = {};
  const rawProps = decl.parameters?.properties ?? {};
  for (const [k, v] of Object.entries(rawProps)) {
    props[k] = {
      type: String(v.type ?? 'STRING').toLowerCase(),
      description: v.description,
    };
  }
  return {
    type: 'object' as const,
    properties: props,
    required: decl.parameters?.required ?? [],
  };
}

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  const num = typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  return Math.max(min, Math.min(max, num));
}

function executeSupportingTool(
  toolName: string,
  rawArgs: Record<string, unknown> | undefined,
  params: Record<string, unknown>,
  state: Record<string, unknown>,
): { result: Record<string, unknown>; argsSummary: string; resultSummary: string } {
  const args = rawArgs ?? {};

  switch (toolName) {
    case 'calcCashFlowStress': {
      const dsoDelta = clampNumber(args.dsoDeltaDays, -30, 45, 10);
      const capexRate = clampNumber(
        args.capexRatePct,
        10,
        80,
        Number(params.reinvestmentRate ?? 38),
      );
      const ocf = Number(state.operatingCashFlow ?? 260);
      const baseDso = Number(params.receivableDays ?? 45);
      const stressedDso = Math.max(15, baseDso + dsoDelta);
      const stressedCapex = Number(((ocf * capexRate) / 100).toFixed(1));
      const stressedDrag = Number(((stressedDso - 30) * 1.15).toFixed(1));
      const stressedFcf = Number((ocf - stressedCapex - stressedDrag).toFixed(1));
      const runway =
        stressedFcf >= 0
          ? 48
          : Math.max(3, Math.round(320 / Math.max(8, Math.abs(stressedFcf))));
      return {
        argsSummary: `DSO ${dsoDelta >= 0 ? '+' : ''}${dsoDelta}d, CapEx ${capexRate}%`,
        resultSummary: `FCF=${stressedFcf}M, Runway=${runway}T`,
        result: {
          stressedDsoDays: stressedDso,
          stressedCapexM: stressedCapex,
          stressedFcfM: stressedFcf,
          cashRunwayMonths: runway,
        },
      };
    }

    case 'calcGeopoliticalShock': {
      const escalation = clampNumber(
        args.escalationShock,
        0,
        100,
        Number(params.warEscalation ?? 28),
      );
      const hedge = clampNumber(
        args.hedgeRatioPct,
        0,
        100,
        Number(params.commodityHedgePct ?? 40),
      );
      const oilShock = Number((escalation * 0.52 * (1 - hedge / 160)).toFixed(1));
      const warVol = Number(((escalation / 100) * 12.5 * (1 - hedge / 180)).toFixed(2));
      const recommendedHedge = Math.min(95, Math.round(escalation * 0.85));
      return {
        argsSummary: `Leo thang ${escalation}/100, Hedge ${hedge}%`,
        resultSummary: `Sốc dầu +${oilShock}%, Vol +${warVol}%`,
        result: {
          escalationShock: escalation,
          oilShockPct: oilShock,
          warVolContributionPct: warVol,
          recommendedCommodityHedgePct: recommendedHedge,
        },
      };
    }

    case 'compareHistoricalRegime': {
      const reg = typeof args.regimeId === 'string' ? args.regimeId : '2022_inflation';
      const presets: Record<string, { name: string; peakDropPct: number; recoveryMonths: number }> = {
        '2008_gfc': { name: 'Khủng hoảng 2008', peakDropPct: -46.2, recoveryMonths: 38 },
        '2020_covid': { name: 'Đại dịch 2020', peakDropPct: -31.8, recoveryMonths: 6 },
        '2022_inflation': { name: 'Lãi suất 2022', peakDropPct: -24.5, recoveryMonths: 17 },
      };
      const picked = presets[reg] ?? presets['2022_inflation'];
      const curVar = Number(state.var95Pct ?? 12);
      const similarity = Math.round(
        Math.max(25, Math.min(95, 92 - Math.abs(Math.abs(picked.peakDropPct) - curVar * 1.9) * 1.4)),
      );
      return {
        argsSummary: `Chu kỳ ${reg}`,
        resultSummary: `Tương đồng ${similarity}% (Đỉnh ${picked.peakDropPct}%)`,
        result: {
          regimeName: picked.name,
          historicalPeakDropPct: picked.peakDropPct,
          recoveryMonths: picked.recoveryMonths,
          similarityPct: similarity,
        },
      };
    }

    case 'simulateMacroPolicy': {
      const rate = clampNumber(args.targetPolicyRate, 1.0, 9.0, Number(params.policyRate ?? 4.5));
      const liq = clampNumber(
        args.liquidityDeltaB,
        -50,
        50,
        Number(params.liquidityInjection ?? 10),
      );
      const war = Number(params.warEscalation ?? 28);
      const fiscal = Number(params.fiscalStimulus ?? 42);
      const rateTight = (rate - 4.0) * 1.1;
      const qeBoost = liq * 0.045;
      const fiscalBoost = (fiscal - 40) * 0.03;
      const projInflation = Number(
        Math.max(
          1.2,
          Math.min(
            11.5,
            2.6 + qeBoost * 0.7 + fiscalBoost * 0.55 + war * 0.028 - rateTight * 0.65,
          ),
        ).toFixed(2),
      );
      const projGdp = Number(
        Math.max(
          -2.5,
          Math.min(7.5, 3.4 + qeBoost * 0.45 + fiscalBoost * 0.6 - rateTight * 0.55 - war * 0.018),
        ).toFixed(2),
      );
      const projSpread = Math.round(
        Math.max(
          75,
          Math.min(560, 145 + war * 1.85 + Math.max(0, rate - 4.2) * 32 - qeBoost * 18),
        ),
      );
      return {
        argsSummary: `Rate ${rate}%, QE/QT ${liq >= 0 ? '+' : ''}${liq}B`,
        resultSummary: `GDP ${projGdp}%, CPI ${projInflation}%, Spread ${projSpread}bps`,
        result: {
          projectedGdpPct: projGdp,
          projectedInflationPct: projInflation,
          creditSpreadBps: projSpread,
        },
      };
    }

    case 'calcPortfolioTailRisk': {
      const coinW = clampNumber(args.coinWeightPct, 0, 45, Number(params.coinWeight ?? 12));
      const memeW = clampNumber(
        args.memeCoinWeightPct,
        0,
        25,
        Number(params.memeCoinWeight ?? 4),
      );
      const hedgeOn =
        typeof args.enableHedge === 'boolean' ? args.enableHedge : Boolean(params.hedgingActive);
      const eqW = Number(params.equityWeight ?? 38);
      const bdW = Number(params.bondWeight ?? 22);
      const cmW = Number(params.commodityWeight ?? 14);
      const caW = Number(params.cashWeight ?? 10);
      const sum = Math.max(1, eqW + bdW + cmW + coinW + memeW + caW);
      const baseVol =
        (eqW / sum) * 18.5 +
        (bdW / sum) * 6.5 +
        (cmW / sum) * 15.0 +
        (coinW / sum) * 46.0 +
        (memeW / sum) * 94.0 +
        (caW / sum) * 0.8;
      const warVol = Number(state.warVolContribution ?? 2.5);
      const simVol = Number(((baseVol + warVol * 0.85) * (hedgeOn ? 0.72 : 1)).toFixed(2));
      const simVar = Number((simVol * 1.645 * 0.45).toFixed(2));
      const simCvar = Number((simVar * 1.28).toFixed(2));
      return {
        argsSummary: `Coin ${coinW}%, Meme ${memeW}%, Hedge=${hedgeOn}`,
        resultSummary: `Vol ${simVol}%, VaR -${simVar}%, CVaR -${simCvar}%`,
        result: {
          simulatedVolatilityPct: simVol,
          simulatedVar95Pct: simVar,
          simulatedCvar95Pct: simCvar,
          cryptoCombinedPct: Math.round(((coinW + memeW) / sum) * 100),
        },
      };
    }

    case 'scanLegalClauses': {
      const focusArea = typeof args.focusArea === 'string' ? args.focusArea : 'all';
      const clauses = Array.isArray(state.flaggedClauses) ? state.flaggedClauses : [];
      const score = Number(state.legalRiskScore ?? 20);
      const haircut = Number(state.legalHaircutPct ?? 1.1);
      return {
        argsSummary: `Phạm vi ${focusArea}`,
        resultSummary: `Điểm PL ${score}/100, ${clauses.length} cờ, Haircut -${haircut}%`,
        result: {
          legalRiskScore: score,
          legalHaircutPct: haircut,
          flaggedCount: clauses.length,
          flaggedClauses: clauses,
        },
      };
    }

    case 'checkCovenantsAndLiquidity': {
      const mult = clampNumber(args.stressMultiplier, 1.0, 2.0, 1.25);
      const liqScore = Math.min(100, Math.round(Number(state.liquidityRiskScore ?? 35) * mult));
      const invScore = Math.min(
        100,
        Math.round(Number(state.investmentRiskScore ?? 40) * (0.7 + 0.3 * mult)),
      );
      const breaches = Array.isArray(state.covenantBreaches) ? state.covenantBreaches : [];
      const memeW = Number(params.memeCoinWeight ?? 4);
      return {
        argsSummary: `Stress x${mult.toFixed(2)}`,
        resultSummary: `Rủi ro ĐT ${invScore}/100, Thanh khoản ${liqScore}/100, Vi phạm ${breaches.length}`,
        result: {
          stressedInvestmentRisk: invScore,
          stressedLiquidityRisk: liqScore,
          memeCoinExposure: memeW,
          activeBreaches: breaches,
        },
      };
    }

    default:
      return {
        argsSummary: JSON.stringify(args),
        resultSummary: 'Không xác định',
        result: { note: `Unknown tool ${toolName}` },
      };
  }
}

function getGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatProviderError(
  provider: LlmProviderId,
  err: unknown,
): { status: number; message: string } {
  const errorObj = err as { status?: number; statusCode?: number; message?: string };
  const rawMessage = errorObj.message || `Lỗi khi gọi ${PROVIDER_REGISTRY[provider].label}.`;
  let status = errorObj.statusCode || errorObj.status || 500;

  if (
    status === 429 ||
    rawMessage.includes('"code":429') ||
    rawMessage.includes('RESOURCE_EXHAUSTED') ||
    rawMessage.toLowerCase().includes('rate limit') ||
    rawMessage.toLowerCase().includes('quota')
  ) {
    PROVIDER_REGISTRY[provider].usedToday = PROVIDER_REGISTRY[provider].dailyLimit;
    return {
      status: 429,
      message: `${PROVIDER_REGISTRY[provider].label} vượt giới hạn quota / rate-limit (429). Vui lòng chuyển sang Provider khác, tăng giới hạn hoặc kiểm tra API Key trong Settings > Secrets.`,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    rawMessage.includes('PERMISSION_DENIED') ||
    rawMessage.includes('API_KEY_INVALID') ||
    rawMessage.toLowerCase().includes('invalid x-api-key') ||
    rawMessage.toLowerCase().includes('incorrect api key')
  ) {
    return {
      status: status === 401 ? 401 : 403,
      message: `${PROVIDER_REGISTRY[provider].envVarName} không hợp lệ hoặc không có quyền truy cập. Vui lòng cập nhật trong Settings > Secrets.`,
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: rawMessage,
  };
}

function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error('Phản hồi JSON từ model không hợp lệ.');
  }
}

const FULL_SWARM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    specialistReports: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          agentId: { type: Type.STRING },
          stance: { type: Type.STRING },
          confidence: { type: Type.INTEGER },
          summary: { type: Type.STRING },
          messageToCenter: { type: Type.STRING },
        },
        required: ['agentId', 'stance', 'confidence', 'summary', 'messageToCenter'],
      },
    },
    dialogueTurns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          round: { type: Type.INTEGER },
          fromId: { type: Type.STRING },
          toId: { type: Type.STRING },
          message: { type: Type.STRING },
          stance: { type: Type.STRING },
        },
        required: ['round', 'fromId', 'toId', 'message'],
      },
    },
    orchestrator: {
      type: Type.OBJECT,
      properties: {
        consensusStance: { type: Type.STRING },
        tradeDecision: { type: Type.STRING },
        targetAsset: { type: Type.STRING },
        confidence: { type: Type.INTEGER },
        executiveSummary: { type: Type.STRING },
        conflictResolution: { type: Type.STRING },
        paramsPatch: {
          type: Type.OBJECT,
          properties: {
            equityWeight: { type: Type.INTEGER },
            bondWeight: { type: Type.INTEGER },
            commodityWeight: { type: Type.INTEGER },
            coinWeight: { type: Type.INTEGER },
            memeCoinWeight: { type: Type.INTEGER },
            cashWeight: { type: Type.INTEGER },
            hedgingActive: { type: Type.BOOLEAN },
            commodityHedgePct: { type: Type.INTEGER },
            reinvestmentRate: { type: Type.INTEGER },
            policyRate: { type: Type.NUMBER },
            liquidityInjection: { type: Type.INTEGER },
            stopLossThreshold: { type: Type.INTEGER },
          },
          required: [
            'equityWeight',
            'bondWeight',
            'commodityWeight',
            'coinWeight',
            'memeCoinWeight',
            'cashWeight',
            'hedgingActive',
            'commodityHedgePct',
            'reinvestmentRate',
            'policyRate',
            'liquidityInjection',
            'stopLossThreshold',
          ],
        },
      },
      required: [
        'consensusStance',
        'tradeDecision',
        'targetAsset',
        'confidence',
        'executiveSummary',
        'conflictResolution',
        'paramsPatch',
      ],
    },
  },
  required: ['specialistReports', 'dialogueTurns', 'orchestrator'],
};

const JSON_CONTRACT_INSTRUCTION = `Xuất ĐÚNG JSON object tiếng Việt có cấu trúc:
{
  "specialistReports": [7 object với agentId là "department1".."department5","lawer1","lawer2", stance trong ["bullish","neutral","cautious","veto"], confidence 1..100, summary (1-2 câu nêu kết quả tool), messageToCenter (1 câu)],
  "dialogueTurns": [4 object vòng 2 với round=2, fromId="center" hoặc mã agent, toId="mã agent" hoặc "center", message, stance],
  "orchestrator": {
    "consensusStance": "Tấn công tăng trưởng | Cân bằng chiến thuật | Phòng thủ chủ động | Bảo toàn vốn khẩn cấp",
    "tradeDecision": "MUA | GIỮ | BÁN",
    "targetAsset": "Cổ phiếu | Trái phiếu | Hàng hóa | Coin (BTC/ETH) | Meme Coin | Toàn danh mục",
    "confidence": 1..100,
    "executiveSummary": "1-2 câu tiếng Việt",
    "conflictResolution": "1-2 câu tiếng Việt",
    "paramsPatch": { "equityWeight": int, "bondWeight": int, "commodityWeight": int, "coinWeight": int, "memeCoinWeight": int, "cashWeight": int, "hedgingActive": bool, "commodityHedgePct": int, "reinvestmentRate": int, "policyRate": number, "liquidityInjection": int, "stopLossThreshold": int }
  }
}`;

function createEmptyToolMap(): Record<SpecialistId, ToolInvocationRecord[]> {
  return {
    department1: [],
    department2: [],
    department3: [],
    department4: [],
    department5: [],
    lawer1: [],
    lawer2: [],
  };
}

function recordToolInvocation(
  toolsByAgent: Record<SpecialistId, ToolInvocationRecord[]>,
  toolName: string,
  args: Record<string, unknown> | undefined,
  params: Record<string, unknown>,
  state: Record<string, unknown>,
) {
  const exec = executeSupportingTool(toolName, args, params, state);
  const ownerId = TOOL_OWNER_AGENT[toolName];
  if (ownerId) {
    toolsByAgent[ownerId].push({
      toolName,
      argsSummary: exec.argsSummary,
      resultSummary: exec.resultSummary,
    });
  }
  return exec;
}

async function runSwarmWithGemini(
  apiKey: string,
  model: string,
  turn1Prompt: string,
  params: Record<string, unknown>,
  state: Record<string, unknown>,
): Promise<{ parsed: ParsedSwarmPayload; toolsByAgent: Record<SpecialistId, ToolInvocationRecord[]> }> {
  const ai = getGeminiClient(apiKey);
  const toolsByAgent = createEmptyToolMap();

  const turn1 = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: turn1Prompt }] }],
    config: {
      systemInstruction:
        'Bạn là hệ thống điều phối Agent Swarm gồm 7 phòng ban và Trung tâm CIO-Core. Ở lượt đầu tiên, BẮT BUỘC gọi đồng thời các công cụ hỗ trợ (function calling) để chạy kiểm chứng định lượng.',
      tools: [{ functionDeclarations: ALL_DEPARTMENT_TOOLS }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });
  PROVIDER_REGISTRY.gemini.usedToday += 1;

  const previousContent = turn1.candidates?.[0]?.content;
  const functionCalls = turn1.functionCalls ?? [];
  const turn2Contents: Content[] = [{ role: 'user', parts: [{ text: turn1Prompt }] }];

  if (previousContent && functionCalls.length > 0) {
    const fnResponseParts: Part[] = [];
    for (const call of functionCalls) {
      const toolName = call.name ?? 'tool';
      const exec = recordToolInvocation(
        toolsByAgent,
        toolName,
        (call.args ?? {}) as Record<string, unknown>,
        params,
        state,
      );
      fnResponseParts.push({
        functionResponse: {
          id: call.id,
          name: call.name,
          response: { output: exec.result },
        },
      });
    }
    turn2Contents.push(previousContent);
    turn2Contents.push({ role: 'user', parts: fnResponseParts });
  } else if (turn1.text) {
    turn2Contents.push({ role: 'model', parts: [{ text: turn1.text }] });
    turn2Contents.push({
      role: 'user',
      parts: [{ text: 'Hãy xuất báo cáo 7 phòng ban, đối thoại vòng 2 và quyết định cuối theo JSON schema.' }],
    });
  }

  const turn2 = await ai.models.generateContent({
    model,
    contents: turn2Contents,
    config: {
      systemInstruction:
        'Tổng hợp báo cáo 7 phòng ban, đối thoại chất vấn vòng 2 (CIO-Core ↔ phòng ban) và chốt MUA / GIỮ / BÁN kèm paramsPatch theo đúng JSON schema.',
      responseMimeType: 'application/json',
      responseSchema: FULL_SWARM_SCHEMA,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });
  PROVIDER_REGISTRY.gemini.usedToday += 1;

  return {
    parsed: extractJsonObject(turn2.text ?? '{}') as ParsedSwarmPayload,
    toolsByAgent,
  };
}

async function runSwarmWithOpenAICompatible(
  provider: 'openai' | 'openrouter',
  apiKey: string,
  model: string,
  turn1Prompt: string,
  params: Record<string, unknown>,
  state: Record<string, unknown>,
): Promise<{ parsed: ParsedSwarmPayload; toolsByAgent: Record<SpecialistId, ToolInvocationRecord[]> }> {
  const endpoint =
    provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.APP_URL || 'http://localhost:3000';
    headers['X-Title'] = 'FinWorld 3D Agent Swarm';
  }

  const openAiTools = ALL_DEPARTMENT_TOOLS.map((decl) => ({
    type: 'function' as const,
    function: {
      name: decl.name,
      description: decl.description,
      parameters: toStandardToolSchema(decl),
    },
  }));

  const toolsByAgent = createEmptyToolMap();
  const messages: Array<Record<string, unknown>> = [
    {
      role: 'system',
      content:
        'Bạn là hệ thống Agent Swarm gồm 7 phòng ban tài chính/pháp lý và Trung tâm CIO-Core. Lượt đầu hãy gọi các công cụ hỗ trợ được cấp để kiểm chứng định lượng.',
    },
    { role: 'user', content: turn1Prompt },
  ];

  const resp1 = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      tools: openAiTools,
      tool_choice: 'auto',
    }),
  });
  PROVIDER_REGISTRY[provider].usedToday += 1;

  if (!resp1.ok) {
    const errBody = await resp1.text();
    throw Object.assign(new Error(errBody || `HTTP ${resp1.status}`), { statusCode: resp1.status });
  }

  const data1 = (await resp1.json()) as {
    choices?: Array<{
      message?: {
        role?: string;
        content?: string | null;
        tool_calls?: Array<{
          id: string;
          type: string;
          function: { name: string; arguments: string };
        }>;
      };
    }>;
  };
  const msg1 = data1.choices?.[0]?.message;
  const toolCalls = msg1?.tool_calls ?? [];

  if (toolCalls.length > 0) {
    messages.push(msg1 as Record<string, unknown>);
    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
      } catch {
        args = {};
      }
      const exec = recordToolInvocation(toolsByAgent, call.function.name, args, params, state);
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(exec.result),
      });
    }
  } else if (msg1?.content) {
    messages.push({ role: 'assistant', content: msg1.content });
  }

  messages.push({
    role: 'user',
    content: JSON_CONTRACT_INSTRUCTION,
  });

  const resp2 = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: 'json_object' },
    }),
  });
  PROVIDER_REGISTRY[provider].usedToday += 1;

  if (!resp2.ok) {
    const errBody = await resp2.text();
    throw Object.assign(new Error(errBody || `HTTP ${resp2.status}`), { statusCode: resp2.status });
  }

  const data2 = (await resp2.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text2 = data2.choices?.[0]?.message?.content ?? '{}';

  return {
    parsed: extractJsonObject(text2) as ParsedSwarmPayload,
    toolsByAgent,
  };
}

async function runSwarmWithAnthropic(
  apiKey: string,
  model: string,
  turn1Prompt: string,
  params: Record<string, unknown>,
  state: Record<string, unknown>,
): Promise<{ parsed: ParsedSwarmPayload; toolsByAgent: Record<SpecialistId, ToolInvocationRecord[]> }> {
  const endpoint = 'https://api.anthropic.com/v1/messages';
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  const anthropicTools = ALL_DEPARTMENT_TOOLS.map((decl) => ({
    name: decl.name,
    description: decl.description,
    input_schema: toStandardToolSchema(decl),
  }));

  const toolsByAgent = createEmptyToolMap();
  const systemPrompt =
    'Bạn là hệ thống Agent Swarm gồm 7 phòng ban và CIO-Core. Lượt đầu hãy gọi các công cụ hỗ trợ được cấp, lượt sau xuất kết quả tiếng Việt theo đúng cấu trúc JSON.';

  const messages: Array<Record<string, unknown>> = [
    { role: 'user', content: turn1Prompt },
  ];

  const resp1 = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system: systemPrompt,
      tools: anthropicTools,
      messages,
    }),
  });
  PROVIDER_REGISTRY.anthropic.usedToday += 1;

  if (!resp1.ok) {
    const errBody = await resp1.text();
    throw Object.assign(new Error(errBody || `HTTP ${resp1.status}`), { statusCode: resp1.status });
  }

  const data1 = (await resp1.json()) as {
    content?: Array<{
      type: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
      text?: string;
    }>;
  };
  const blocks = data1.content ?? [];
  const toolUseBlocks = blocks.filter((b) => b.type === 'tool_use');

  messages.push({ role: 'assistant', content: blocks });

  if (toolUseBlocks.length > 0) {
    const toolResults = toolUseBlocks.map((b) => {
      const exec = recordToolInvocation(toolsByAgent, b.name ?? '', b.input, params, state);
      return {
        type: 'tool_result',
        tool_use_id: b.id,
        content: JSON.stringify(exec.result),
      };
    });
    messages.push({
      role: 'user',
      content: [...toolResults, { type: 'text', text: JSON_CONTRACT_INSTRUCTION }],
    });
  } else {
    messages.push({
      role: 'user',
      content: JSON_CONTRACT_INSTRUCTION,
    });
  }

  const resp2 = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    }),
  });
  PROVIDER_REGISTRY.anthropic.usedToday += 1;

  if (!resp2.ok) {
    const errBody = await resp2.text();
    throw Object.assign(new Error(errBody || `HTTP ${resp2.status}`), { statusCode: resp2.status });
  }

  const data2 = (await resp2.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const textBlock = (data2.content ?? []).find((b) => b.type === 'text')?.text ?? '{}';

  return {
    parsed: extractJsonObject(textBlock) as ParsedSwarmPayload,
    toolsByAgent,
  };
}

async function testProviderConnection(
  provider: LlmProviderId,
  requestedModel?: string,
): Promise<{ latencyMs: number; model: string; reply: string }> {
  const entry = PROVIDER_REGISTRY[provider];
  const apiKey = getProviderApiKey(provider);
  if (!apiKey) {
    throw Object.assign(
      new Error(
        `Chưa cấu hình ${entry.envVarName} trong môi trường máy chủ (Settings > Secrets).`,
      ),
      { statusCode: 400 },
    );
  }

  const model = requestedModel?.trim() || entry.defaultModel;
  const started = Date.now();

  if (provider === 'gemini') {
    const ai = getGeminiClient(apiKey);
    const resp = await ai.models.generateContent({
      model,
      contents: 'Reply with exactly: OK',
      config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    });
    entry.usedToday += 1;
    return {
      latencyMs: Date.now() - started,
      model,
      reply: (resp.text ?? 'OK').trim().slice(0, 60),
    };
  }

  if (provider === 'anthropic') {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      }),
    });
    entry.usedToday += 1;
    if (!resp.ok) {
      const txt = await resp.text();
      throw Object.assign(new Error(txt || `HTTP ${resp.status}`), { statusCode: resp.status });
    }
    const data = (await resp.json()) as { content?: Array<{ text?: string }> };
    return {
      latencyMs: Date.now() - started,
      model,
      reply: (data.content?.[0]?.text ?? 'OK').trim().slice(0, 60),
    };
  }

  const endpoint =
    provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.APP_URL || 'http://localhost:3000';
    headers['X-Title'] = 'FinWorld 3D Agent Swarm';
  }
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
    }),
  });
  entry.usedToday += 1;
  if (!resp.ok) {
    const txt = await resp.text();
    throw Object.assign(new Error(txt || `HTTP ${resp.status}`), { statusCode: resp.status });
  }
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return {
    latencyMs: Date.now() - started,
    model,
    reply: (data.choices?.[0]?.message?.content ?? 'OK').trim().slice(0, 60),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, model: DEFAULT_GEMINI_MODEL });
  });

  app.get('/api/providers/status', (_req, res) => {
    res.json({
      providers: getAllProviderStatus(),
      quotaSettings,
    });
  });

  app.post('/api/providers/quota', (req, res) => {
    const { provider, dailyLimit, minIntervalSec, autoFallbackOn429, resetUsed } = req.body ?? {};
    if (provider && provider in PROVIDER_REGISTRY) {
      const entry = PROVIDER_REGISTRY[provider as LlmProviderId];
      if (typeof dailyLimit === 'number' && Number.isFinite(dailyLimit)) {
        entry.dailyLimit = Math.max(2, Math.min(5000, Math.round(dailyLimit)));
      }
      if (resetUsed === true) {
        entry.usedToday = 0;
        entry.lastCallAtMs = 0;
      }
    }
    if (typeof minIntervalSec === 'number' && Number.isFinite(minIntervalSec)) {
      quotaSettings.minIntervalSec = Math.max(5, Math.min(120, Math.round(minIntervalSec)));
    }
    if (typeof autoFallbackOn429 === 'boolean') {
      quotaSettings.autoFallbackOn429 = autoFallbackOn429;
    }
    res.json({
      providers: getAllProviderStatus(),
      quotaSettings,
    });
  });

  app.post('/api/providers/test', async (req, res) => {
    const { provider, model } = req.body ?? {};
    const pid: LlmProviderId =
      provider && provider in PROVIDER_REGISTRY ? (provider as LlmProviderId) : 'gemini';
    const entry = PROVIDER_REGISTRY[pid];
    rollDailyQuotaIfNeeded(entry);

    try {
      const out = await testProviderConnection(pid, typeof model === 'string' ? model : undefined);
      entry.lastTestedAt = new Date().toTimeString().slice(0, 8);
      entry.lastTestOk = true;
      entry.lastLatencyMs = out.latencyMs;
      entry.lastMessage = `Kết nối OK (${out.latencyMs}ms · ${out.reply})`;
      res.json({
        ok: true,
        provider: pid,
        model: out.model,
        latencyMs: out.latencyMs,
        reply: out.reply,
        providers: getAllProviderStatus(),
      });
    } catch (err: unknown) {
      const { status, message } = formatProviderError(pid, err);
      entry.lastTestedAt = new Date().toTimeString().slice(0, 8);
      entry.lastTestOk = false;
      entry.lastMessage = message;
      res.status(status).json({
        ok: false,
        provider: pid,
        error: message,
        providers: getAllProviderStatus(),
      });
    }
  });

  app.post('/api/swarm/deliberate', async (req, res) => {
    const startedAt = Date.now();
    const {
      provider: reqProvider,
      model: reqModel,
      mission,
      urgentPriority,
      urgentBreaches,
      params,
      state,
    } = req.body ?? {};

    if (!params || !state) {
      res.status(400).json({ error: 'Thiếu dữ liệu params hoặc state của mô phỏng.' });
      return;
    }

    let activeProvider: LlmProviderId =
      reqProvider && reqProvider in PROVIDER_REGISTRY ? (reqProvider as LlmProviderId) : 'gemini';
    const requestedEntry = PROVIDER_REGISTRY[activeProvider];
    rollDailyQuotaIfNeeded(requestedEntry);

    const selectFallbackProvider = (exclude: LlmProviderId): LlmProviderId | null => {
      if (!quotaSettings.autoFallbackOn429) return null;
      const order: LlmProviderId[] = ['openrouter', 'openai', 'anthropic', 'gemini'];
      for (const candidate of order) {
        if (candidate === exclude) continue;
        const cEntry = PROVIDER_REGISTRY[candidate];
        rollDailyQuotaIfNeeded(cEntry);
        if (getProviderApiKey(candidate) && cEntry.usedToday + 2 <= cEntry.dailyLimit) {
          return candidate;
        }
      }
      return null;
    };

    // Enforce server-side cooldown & daily quota limit before calling LLM
    const nowMs = Date.now();
    const elapsedSec = (nowMs - requestedEntry.lastCallAtMs) / 1000;
    if (requestedEntry.lastCallAtMs > 0 && elapsedSec < quotaSettings.minIntervalSec) {
      const waitSec = Math.ceil(quotaSettings.minIntervalSec - elapsedSec);
      res.status(429).json({
        error: `Quota Cooldown đang bảo vệ ${requestedEntry.label}. Vui lòng chờ ${waitSec}s trước chu kỳ tiếp theo.`,
        providers: getAllProviderStatus(),
      });
      return;
    }

    let failoverNote: string | null = null;
    if (!getProviderApiKey(activeProvider) || requestedEntry.usedToday + 2 > requestedEntry.dailyLimit) {
      const fb = selectFallbackProvider(activeProvider);
      if (fb) {
        failoverNote = `Tự động chuyển từ ${requestedEntry.label} (đạt hạn mức ${requestedEntry.usedToday}/${requestedEntry.dailyLimit}) sang ${PROVIDER_REGISTRY[fb].label}.`;
        activeProvider = fb;
      } else {
        const reason = !getProviderApiKey(activeProvider)
          ? `Chưa cấu hình ${requestedEntry.envVarName} trong Settings > Secrets.`
          : `Đã chạm giới hạn Quota (${requestedEntry.usedToday}/${requestedEntry.dailyLimit} lượt/ngày) cho ${requestedEntry.label}. Tăng Daily Limit, bấm Reset Quota hoặc chọn Provider khác.`;
        res.status(429).json({
          error: reason,
          providers: getAllProviderStatus(),
        });
        return;
      }
    }

    const missionText =
      typeof mission === 'string' && mission.trim().length > 0
        ? mission.trim()
        : 'Đánh giá toàn diện rủi ro, dòng tiền, vĩ mô, pháp lý và tối ưu hóa phân bổ danh mục Center.';

    const activeAssetBreaches = Array.isArray(urgentBreaches)
      ? urgentBreaches
      : Array.isArray(state.assetRiskBreaches)
        ? state.assetRiskBreaches
        : [];
    const isUrgent = Boolean(urgentPriority || activeAssetBreaches.length > 0);

    const worldContext = {
      capitalUsd: state.capitalUsd,
      initialCapitalUsd: params.initialCapitalUsd,
      nav: state.nav,
      expectedReturnPct: state.expectedReturnPct,
      annualVolatilityPct: state.annualVolatilityPct,
      var95Pct: state.var95Pct,
      cvar95Pct: state.cvar95Pct,
      sharpeRatio: state.sharpeRatio,
      covenantBreaches: state.covenantBreaches,
      assetRiskThresholds: params.assetRiskThresholds,
      assetRiskBreaches: activeAssetBreaches,
      departments: {
        department1: {
          operatingCashFlow: state.operatingCashFlow,
          freeCashFlow: state.freeCashFlow,
          cashRunwayMonths: state.cashRunwayMonths,
          reinvestmentRate: params.reinvestmentRate,
          receivableDays: params.receivableDays,
        },
        department2: {
          geopoliticalRiskIndex: state.geopoliticalRiskIndex,
          oilShockPct: state.oilShockPct,
          warEscalation: params.warEscalation,
          commodityHedgePct: params.commodityHedgePct,
        },
        department3: {
          selectedRegimeId: params.selectedRegimeId,
          currentDrawdownPct: state.currentDrawdownPct,
          historicalMatchSimilarity: state.historicalMatchSimilarity,
        },
        department4: {
          policyRate: params.policyRate,
          liquidityInjection: params.liquidityInjection,
          fiscalStimulus: params.fiscalStimulus,
          inflationPct: state.inflationPct,
          gdpGrowthPct: state.gdpGrowthPct,
          creditSpreadBps: state.creditSpreadBps,
        },
        department5: {
          equityWeight: params.equityWeight,
          bondWeight: params.bondWeight,
          commodityWeight: params.commodityWeight,
          coinWeight: params.coinWeight,
          memeCoinWeight: params.memeCoinWeight,
          cashWeight: params.cashWeight,
          hedgingActive: params.hedgingActive,
          stopLossThreshold: params.stopLossThreshold,
        },
        lawer1: {
          legalRiskScore: state.legalRiskScore,
          legalHaircutPct: state.legalHaircutPct,
          flaggedClauses: state.flaggedClauses,
        },
        lawer2: {
          investmentRiskScore: state.investmentRiskScore,
          liquidityRiskScore: state.liquidityRiskScore,
          concentrationRiskScore: state.concentrationRiskScore,
          counterpartyTier: params.counterpartyTier,
        },
      },
    };

    const urgentDirective = isUrgent
      ? `CẢNH BÁO ĐỎ - ƯU TIÊN XỬ LÝ GẤP: Các lớp tài sản sau đang vượt Ngưỡng Rủi Ro Tối Đa: ${JSON.stringify(activeAssetBreaches)}. Hãy ưu tiên hàng đầu việc giảm tỷ trọng / BÁN tài sản vượt ngưỡng, bật hedgingActive=true nếu cần, hoặc tăng tỷ trọng tài sản trú ẩn/tiền mặt để đưa VaR và biến động về dưới ngưỡng.`
      : null;

    const turn1Prompt = [
      ...(urgentDirective ? [urgentDirective] : []),
      `Nhiệm vụ điều phối: "${missionText}"`,
      `Dữ liệu thời gian thực toàn thế giới tài chính 3D:\n${JSON.stringify(worldContext)}`,
      'Hãy gọi song song các công cụ hỗ trợ (calcCashFlowStress, calcGeopoliticalShock, compareHistoricalRegime, simulateMacroPolicy, calcPortfolioTailRisk, scanLegalClauses, checkCovenantsAndLiquidity) để kiểm chứng số liệu trước khi thảo luận qua lại giữa 7 phòng ban và Center CIO.',
    ].join('\n\n');

    const executeForProvider = async (pid: LlmProviderId, modelOverride?: string) => {
      const entry = PROVIDER_REGISTRY[pid];
      const apiKey = getProviderApiKey(pid);
      if (!apiKey) {
        throw Object.assign(
          new Error(`Chưa cấu hình ${entry.envVarName} trong Settings > Secrets.`),
          { statusCode: 400 },
        );
      }
      const chosenModel =
        modelOverride && entry.availableModels.includes(modelOverride)
          ? modelOverride
          : entry.defaultModel;
      entry.lastCallAtMs = Date.now();

      if (pid === 'gemini') {
        const resObj = await runSwarmWithGemini(apiKey, chosenModel, turn1Prompt, params, state);
        return { ...resObj, model: chosenModel };
      }
      if (pid === 'anthropic') {
        const resObj = await runSwarmWithAnthropic(apiKey, chosenModel, turn1Prompt, params, state);
        return { ...resObj, model: chosenModel };
      }
      const resObj = await runSwarmWithOpenAICompatible(
        pid,
        apiKey,
        chosenModel,
        turn1Prompt,
        params,
        state,
      );
      return { ...resObj, model: chosenModel };
    };

    try {
      let swarmOutput: {
        parsed: ParsedSwarmPayload;
        toolsByAgent: Record<SpecialistId, ToolInvocationRecord[]>;
        model: string;
      };

      try {
        swarmOutput = await executeForProvider(
          activeProvider,
          typeof reqModel === 'string' ? reqModel : undefined,
        );
      } catch (primaryErr: unknown) {
        const formatted = formatProviderError(activeProvider, primaryErr);
        if (formatted.status === 429) {
          const fb = selectFallbackProvider(activeProvider);
          if (fb) {
            failoverNote = `${PROVIDER_REGISTRY[activeProvider].label} gặp 429, đã tự động chuyển sang ${PROVIDER_REGISTRY[fb].label}.`;
            activeProvider = fb;
            swarmOutput = await executeForProvider(fb);
          } else {
            throw primaryErr;
          }
        } else {
          throw primaryErr;
        }
      }

      const { parsed, toolsByAgent, model: usedModel } = swarmOutput;
      const validStances = ['bullish', 'neutral', 'cautious', 'veto'] as const;
      const reportMap = new Map((parsed.specialistReports ?? []).map((r) => [r.agentId, r]));

      const specialistReports = SPECIALIST_AGENTS.map((def) => {
        const raw = reportMap.get(def.id);
        const stance = validStances.includes(raw?.stance as (typeof validStances)[number])
          ? (raw?.stance as (typeof validStances)[number])
          : 'neutral';
        return {
          agentId: def.id,
          agentName: def.agentName,
          roleTitle: def.roleTitle,
          stance,
          confidence: Math.round(clampNumber(raw?.confidence, 1, 100, 74)),
          summary: raw?.summary || 'Đã hoàn tất phân tích số liệu phân khu.',
          messageToCenter: raw?.messageToCenter || 'Sẵn sàng phối hợp điều phối vốn.',
          toolsCalled: toolsByAgent[def.id],
        };
      });

      const agentNameById = new Map<string, string>([
        ['center', 'CIO-Core'],
        ['overview', 'Toàn hệ thống'],
        ...SPECIALIST_AGENTS.map((a) => [a.id, a.agentName] as [string, string]),
      ]);

      const dialogueThread: SwarmDialogueTurn[] = [
        ...specialistReports.map((rep) => ({
          id: `dlg-r1-${rep.agentId}`,
          round: 1 as const,
          fromId: rep.agentId,
          fromName: rep.agentName,
          toId: 'center' as const,
          toName: 'CIO-Core',
          message: rep.messageToCenter,
          stance: rep.stance,
        })),
        ...(parsed.dialogueTurns ?? []).map((turn, idx) => {
          const fromId = agentNameById.has(turn.fromId ?? '')
            ? (turn.fromId as SpecialistId | 'center' | 'overview')
            : 'center';
          const toId = agentNameById.has(turn.toId ?? '')
            ? (turn.toId as SpecialistId | 'center' | 'overview')
            : 'center';
          const stance = validStances.includes(turn.stance as (typeof validStances)[number])
            ? (turn.stance as (typeof validStances)[number])
            : undefined;
          return {
            id: `dlg-r2-${idx}`,
            round: 2 as const,
            fromId,
            fromName: agentNameById.get(fromId) ?? 'CIO-Core',
            toId,
            toName: agentNameById.get(toId) ?? 'CIO-Core',
            message: turn.message || 'Trao đổi chỉ số định lượng giữa phân khu và trung tâm.',
            stance,
          };
        }),
      ];

      const orch = parsed.orchestrator ?? {};
      const validTrades = ['MUA', 'GIỮ', 'BÁN'] as const;
      const tradeDecision = validTrades.includes(
        orch.tradeDecision as (typeof validTrades)[number],
      )
        ? (orch.tradeDecision as (typeof validTrades)[number])
        : 'GIỮ';

      const rawPatch = orch.paramsPatch ?? {};
      const sanitizedPatch = {
        equityWeight: Math.round(clampNumber(rawPatch.equityWeight, 5, 75, Number(params.equityWeight))),
        bondWeight: Math.round(clampNumber(rawPatch.bondWeight, 5, 65, Number(params.bondWeight))),
        commodityWeight: Math.round(clampNumber(rawPatch.commodityWeight, 5, 50, Number(params.commodityWeight))),
        coinWeight: Math.round(clampNumber(rawPatch.coinWeight, 0, 35, Number(params.coinWeight))),
        memeCoinWeight: Math.round(clampNumber(rawPatch.memeCoinWeight, 0, 18, Number(params.memeCoinWeight))),
        cashWeight: Math.round(clampNumber(rawPatch.cashWeight, 5, 50, Number(params.cashWeight))),
        hedgingActive:
          typeof rawPatch.hedgingActive === 'boolean'
            ? rawPatch.hedgingActive
            : Boolean(params.hedgingActive),
        commodityHedgePct: Math.round(
          clampNumber(rawPatch.commodityHedgePct, 0, 100, Number(params.commodityHedgePct)),
        ),
        reinvestmentRate: Math.round(
          clampNumber(rawPatch.reinvestmentRate, 15, 75, Number(params.reinvestmentRate)),
        ),
        policyRate: Number(
          clampNumber(rawPatch.policyRate, 1.5, 8.5, Number(params.policyRate)).toFixed(2),
        ),
        liquidityInjection: Math.round(
          clampNumber(rawPatch.liquidityInjection, -45, 45, Number(params.liquidityInjection)),
        ),
        stopLossThreshold: Math.round(
          clampNumber(rawPatch.stopLossThreshold, 6, 22, Number(params.stopLossThreshold)),
        ),
      };

      const finalSummary =
        orch.executiveSummary || 'Đã tổng hợp công cụ hỗ trợ và chốt quyết định cùng các phòng ban.';
      const targetAsset = orch.targetAsset || 'Toàn danh mục';
      const conflictText = failoverNote
        ? `${failoverNote} ${orch.conflictResolution || ''}`.trim()
        : orch.conflictResolution || 'Cân đối giữa kỳ vọng sinh lời và kiểm soát rủi ro.';

      dialogueThread.push({
        id: 'dlg-r3-final',
        round: 3,
        fromId: 'center',
        fromName: 'CIO-Core',
        toId: 'overview',
        toName: 'Toàn hệ thống',
        message: `[${tradeDecision} · ${targetAsset}] ${finalSummary}`,
      });

      res.json({
        runId: `swarm-${Date.now()}`,
        provider: activeProvider,
        model: usedModel,
        latencyMs: Date.now() - startedAt,
        mission: missionText,
        specialistReports,
        dialogueThread,
        orchestrator: {
          consensusStance: orch.consensusStance || 'Cân bằng chiến thuật',
          tradeDecision,
          targetAsset,
          confidence: Math.round(clampNumber(orch.confidence, 1, 100, 75)),
          executiveSummary: finalSummary,
          conflictResolution: conflictText,
          paramsPatch: sanitizedPatch,
        },
        providers: getAllProviderStatus(),
      });
    } catch (err: unknown) {
      const { status, message } = formatProviderError(activeProvider, err);
      res.status(status).json({
        error: message,
        providers: getAllProviderStatus(),
      });
    }
  });

  app.post('/api/analyze/asset', async (req, res) => {
    const startedAt = Date.now();
    const {
      provider: reqProvider,
      model: reqModel,
      assetTarget: reqTarget,
      horizonMinutes: reqHorizon,
      query,
      params,
      state,
    } = req.body ?? {};

    if (!params || !state) {
      res.status(400).json({ error: 'Thiếu dữ liệu params hoặc state của mô phỏng.' });
      return;
    }

    const validTargets = ['gold', 'gold_forex', 'coin', 'meme_coin', 'custom'] as const;
    const assetTarget = validTargets.includes(reqTarget as (typeof validTargets)[number])
      ? (reqTarget as (typeof validTargets)[number])
      : 'coin';
    const horizonMinutes = Math.max(
      1,
      Math.min(1440, Math.round(Number(reqHorizon) || 15)),
    );
    const queryText =
      typeof query === 'string' && query.trim().length > 0
        ? query.trim()
        : `Phân tích xu hướng trong ${horizonMinutes} phút tới tăng hay giảm`;

    const targetLabels: Record<(typeof validTargets)[number], string> = {
      gold: 'Vàng vật chất & Hàng hóa (XAU / GLD)',
      gold_forex: 'Vàng trong Forex (XAU/USD · DXY · Lãi suất)',
      coin: 'Coin (BTC / ETH / SOL)',
      meme_coin: 'Meme Coin (PEPE / DOGE / WIF)',
      custom: 'Tài sản tùy chỉnh',
    };

    let activeProvider: LlmProviderId =
      reqProvider && reqProvider in PROVIDER_REGISTRY ? (reqProvider as LlmProviderId) : 'gemini';
    const requestedEntry = PROVIDER_REGISTRY[activeProvider];
    rollDailyQuotaIfNeeded(requestedEntry);

    const nowMs = Date.now();
    const elapsedSec = (nowMs - requestedEntry.lastCallAtMs) / 1000;
    if (requestedEntry.lastCallAtMs > 0 && elapsedSec < quotaSettings.minIntervalSec) {
      const waitSec = Math.ceil(quotaSettings.minIntervalSec - elapsedSec);
      res.status(429).json({
        error: `Quota Cooldown đang bảo vệ ${requestedEntry.label}. Vui lòng chờ ${waitSec}s.`,
        providers: getAllProviderStatus(),
      });
      return;
    }

    const selectFallback = (exclude: LlmProviderId): LlmProviderId | null => {
      if (!quotaSettings.autoFallbackOn429) return null;
      const order: LlmProviderId[] = ['openrouter', 'openai', 'anthropic', 'gemini'];
      for (const c of order) {
        if (c === exclude) continue;
        const e = PROVIDER_REGISTRY[c];
        rollDailyQuotaIfNeeded(e);
        if (getProviderApiKey(c) && e.usedToday + 1 <= e.dailyLimit) {
          return c;
        }
      }
      return null;
    };

    if (!getProviderApiKey(activeProvider) || requestedEntry.usedToday + 1 > requestedEntry.dailyLimit) {
      const fb = selectFallback(activeProvider);
      if (fb) {
        activeProvider = fb;
      } else {
        const reason = !getProviderApiKey(activeProvider)
          ? `Chưa cấu hình ${requestedEntry.envVarName} trong Settings > Secrets.`
          : `Đã chạm giới hạn Quota (${requestedEntry.usedToday}/${requestedEntry.dailyLimit}) cho ${requestedEntry.label}.`;
        res.status(429).json({
          error: reason,
          providers: getAllProviderStatus(),
        });
        return;
      }
    }

    const signals = Array.isArray(state.assetSignals) ? state.assetSignals : [];
    const analysisSnapshot = {
      assetTarget,
      assetLabel: targetLabels[assetTarget],
      horizonMinutes,
      macro: {
        policyRatePct: params.policyRate,
        liquidityInjectionB: params.liquidityInjection,
        inflationPct: state.inflationPct,
        gdpGrowthPct: state.gdpGrowthPct,
        creditSpreadBps: state.creditSpreadBps,
        geopoliticalRiskIndex: state.geopoliticalRiskIndex,
        oilShockPct: state.oilShockPct,
        warEscalation: params.warEscalation,
      },
      portfolioRisk: {
        annualVolatilityPct: state.annualVolatilityPct,
        var95Pct: state.var95Pct,
        cvar95Pct: state.cvar95Pct,
        sharpeRatio: state.sharpeRatio,
        hedgingActive: params.hedgingActive,
      },
      assetSignals: signals,
    };

    const userPrompt = [
      `Yêu cầu phân tích tài sản: "${queryText}"`,
      `Đối tượng mục tiêu: ${targetLabels[assetTarget]} (${assetTarget})`,
      `Khung thời gian dự báo: ${horizonMinutes} phút tới (TĂNG / GIẢM / ĐI NGANG)`,
      `Số liệu thị trường thời gian thực:\n${JSON.stringify(analysisSnapshot)}`,
      'Hãy trả lời bằng tiếng Việt thật rõ ràng, định lượng ngắn gọn, nêu rõ xác suất tăng/giảm trong đúng khung N phút, vùng vào lệnh (entryZone), mục tiêu (targetPrice), cắt lỗ (stopLossPrice), các động lực chính, tương quan Forex/DXY (nếu là Vàng/Vàng Forex), cảnh báo rủi ro và khuyến nghị MUA / GIỮ / BÁN.',
    ].join('\n\n');

    const ANALYSIS_SCHEMA = {
      type: Type.OBJECT,
      properties: {
        assetLabel: { type: Type.STRING },
        direction: { type: Type.STRING },
        confidencePct: { type: Type.INTEGER },
        expectedMovePct: { type: Type.NUMBER },
        entryZone: { type: Type.STRING },
        targetPrice: { type: Type.STRING },
        stopLossPrice: { type: Type.STRING },
        summary: { type: Type.STRING },
        drivers: { type: Type.ARRAY, items: { type: Type.STRING } },
        forexCorrelationNote: { type: Type.STRING },
        riskWarning: { type: Type.STRING },
        recommendedAction: { type: Type.STRING },
      },
      required: [
        'assetLabel',
        'direction',
        'confidencePct',
        'expectedMovePct',
        'entryZone',
        'targetPrice',
        'stopLossPrice',
        'summary',
        'drivers',
        'riskWarning',
        'recommendedAction',
      ],
    };

    const ANALYSIS_JSON_GUIDE =
      'Chỉ trả về JSON hợp lệ gồm các trường: assetLabel (string), direction ("TĂNG"|"GIẢM"|"ĐI NGANG"), confidencePct (1-99), expectedMovePct (number, âm nếu giảm), entryZone (string), targetPrice (string), stopLossPrice (string), summary (string), drivers (string[] 3-4 ý), forexCorrelationNote (string), riskWarning (string), recommendedAction ("MUA"|"GIỮ"|"BÁN").';

    const runAnalysisForProvider = async (pid: LlmProviderId, modelOverride?: string) => {
      const entry = PROVIDER_REGISTRY[pid];
      const apiKey = getProviderApiKey(pid);
      if (!apiKey) {
        throw Object.assign(new Error(`Chưa cấu hình ${entry.envVarName}.`), { statusCode: 400 });
      }
      const chosenModel =
        modelOverride && entry.availableModels.includes(modelOverride)
          ? modelOverride
          : entry.defaultModel;
      entry.lastCallAtMs = Date.now();

      if (pid === 'gemini') {
        const ai = getGeminiClient(apiKey);
        const resp = await ai.models.generateContent({
          model: chosenModel,
          contents: userPrompt,
          config: {
            systemInstruction:
              'Bạn là chuyên gia phân tích định lượng đa tài sản (Vàng, XAU/USD Forex, Crypto Coin, Meme Coin). Dự báo ngắn hạn khung N phút dựa trên động lượng, thanh khoản QE/QT, lãi suất, DXY proxy và rủi ro địa chính trị.',
            responseMimeType: 'application/json',
            responseSchema: ANALYSIS_SCHEMA,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        entry.usedToday += 1;
        return { parsed: extractJsonObject(resp.text ?? '{}'), model: chosenModel };
      }

      if (pid === 'anthropic') {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: chosenModel,
            max_tokens: 1024,
            system: `Bạn là chuyên gia phân tích định lượng Vàng, XAU/USD Forex, Coin và Meme Coin. ${ANALYSIS_JSON_GUIDE}`,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });
        entry.usedToday += 1;
        if (!resp.ok) {
          const errTxt = await resp.text();
          throw Object.assign(new Error(errTxt || `HTTP ${resp.status}`), {
            statusCode: resp.status,
          });
        }
        const data = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
        const txt = (data.content ?? []).find((b) => b.type === 'text')?.text ?? '{}';
        return { parsed: extractJsonObject(txt), model: chosenModel };
      }

      const endpoint =
        pid === 'openai'
          ? 'https://api.openai.com/v1/chat/completions'
          : 'https://openrouter.ai/api/v1/chat/completions';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
      if (pid === 'openrouter') {
        headers['HTTP-Referer'] = process.env.APP_URL || 'http://localhost:3000';
        headers['X-Title'] = 'FinWorld 3D Agent Swarm';
      }
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: chosenModel,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `Bạn là chuyên gia phân tích định lượng Vàng, XAU/USD Forex, Coin và Meme Coin. ${ANALYSIS_JSON_GUIDE}`,
            },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      entry.usedToday += 1;
      if (!resp.ok) {
        const errTxt = await resp.text();
        throw Object.assign(new Error(errTxt || `HTTP ${resp.status}`), {
          statusCode: resp.status,
        });
      }
      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return {
        parsed: extractJsonObject(data.choices?.[0]?.message?.content ?? '{}'),
        model: chosenModel,
      };
    };

    try {
      let out: { parsed: Record<string, unknown>; model: string };
      try {
        out = await runAnalysisForProvider(
          activeProvider,
          typeof reqModel === 'string' ? reqModel : undefined,
        );
      } catch (primaryErr: unknown) {
        const formatted = formatProviderError(activeProvider, primaryErr);
        const fb = formatted.status === 429 ? selectFallback(activeProvider) : null;
        if (fb) {
          activeProvider = fb;
          out = await runAnalysisForProvider(fb);
        } else {
          throw primaryErr;
        }
      }

      const p = out.parsed;
      const validDirections = ['TĂNG', 'GIẢM', 'ĐI NGANG'] as const;
      const direction = validDirections.includes(
        p.direction as (typeof validDirections)[number],
      )
        ? (p.direction as (typeof validDirections)[number])
        : 'ĐI NGANG';

      const validActions = ['MUA', 'GIỮ', 'BÁN'] as const;
      const recommendedAction = validActions.includes(
        p.recommendedAction as (typeof validActions)[number],
      )
        ? (p.recommendedAction as (typeof validActions)[number])
        : 'GIỮ';

      const drivers = Array.isArray(p.drivers)
        ? p.drivers.filter((d): d is string => typeof d === 'string').slice(0, 5)
        : [];

      res.json({
        runId: `anl-${Date.now()}`,
        provider: activeProvider,
        model: out.model,
        latencyMs: Date.now() - startedAt,
        assetTarget,
        assetLabel:
          typeof p.assetLabel === 'string' && p.assetLabel.trim()
            ? p.assetLabel.trim()
            : targetLabels[assetTarget],
        horizonMinutes,
        query: queryText,
        direction,
        confidencePct: Math.round(clampNumber(p.confidencePct, 1, 99, 68)),
        expectedMovePct: Number(clampNumber(p.expectedMovePct, -25, 25, 0.85).toFixed(2)),
        entryZone: typeof p.entryZone === 'string' ? p.entryZone : 'Vùng giá hiện tại',
        targetPrice: typeof p.targetPrice === 'string' ? p.targetPrice : 'Chốt lời theo động lượng',
        stopLossPrice: typeof p.stopLossPrice === 'string' ? p.stopLossPrice : 'Quản trị cắt lỗ chặt',
        summary:
          typeof p.summary === 'string'
            ? p.summary
            : `Dự báo ${targetLabels[assetTarget]} có xu hướng ${direction} trong ${horizonMinutes} phút tới.`,
        drivers,
        forexCorrelationNote:
          typeof p.forexCorrelationNote === 'string' ? p.forexCorrelationNote : undefined,
        riskWarning:
          typeof p.riskWarning === 'string'
            ? p.riskWarning
            : 'Theo dõi biến động thanh khoản và tin tức lãi suất trong khung ngắn hạn.',
        recommendedAction,
        providers: getAllProviderStatus(),
      });
    } catch (err: unknown) {
      const { status, message } = formatProviderError(activeProvider, err);
      res.status(status).json({
        error: message,
        providers: getAllProviderStatus(),
      });
    }
  });

  app.post('/api/swarm/derivatives', async (req, res) => {
    const startedAt = Date.now();
    const {
      provider: reqProvider,
      model: reqModel,
      instrumentFocus,
      directive,
      params,
      state,
    } = req.body ?? {};

    if (!params || !state) {
      res.status(400).json({ error: 'Thiếu dữ liệu params hoặc state của mô phỏng.' });
      return;
    }

    let activeProvider: LlmProviderId =
      reqProvider && reqProvider in PROVIDER_REGISTRY ? (reqProvider as LlmProviderId) : 'gemini';
    const requestedEntry = PROVIDER_REGISTRY[activeProvider];
    rollDailyQuotaIfNeeded(requestedEntry);

    const nowMs = Date.now();
    const elapsedSec = (nowMs - requestedEntry.lastCallAtMs) / 1000;
    if (requestedEntry.lastCallAtMs > 0 && elapsedSec < quotaSettings.minIntervalSec) {
      const waitSec = Math.ceil(quotaSettings.minIntervalSec - elapsedSec);
      res.status(429).json({
        error: `Quota Cooldown đang bảo vệ ${requestedEntry.label}. Vui lòng chờ ${waitSec}s.`,
        providers: getAllProviderStatus(),
      });
      return;
    }

    const selectFallback = (exclude: LlmProviderId): LlmProviderId | null => {
      if (!quotaSettings.autoFallbackOn429) return null;
      const order: LlmProviderId[] = ['openrouter', 'openai', 'anthropic', 'gemini'];
      for (const c of order) {
        if (c === exclude) continue;
        const e = PROVIDER_REGISTRY[c];
        rollDailyQuotaIfNeeded(e);
        if (getProviderApiKey(c) && e.usedToday + 1 <= e.dailyLimit) {
          return c;
        }
      }
      return null;
    };

    if (!getProviderApiKey(activeProvider) || requestedEntry.usedToday + 1 > requestedEntry.dailyLimit) {
      const fb = selectFallback(activeProvider);
      if (fb) {
        activeProvider = fb;
      } else {
        const reason = !getProviderApiKey(activeProvider)
          ? `Chưa cấu hình ${requestedEntry.envVarName} trong Settings > Secrets.`
          : `Đã chạm giới hạn Quota (${requestedEntry.usedToday}/${requestedEntry.dailyLimit}) cho ${requestedEntry.label}.`;
        res.status(429).json({
          error: reason,
          providers: getAllProviderStatus(),
        });
        return;
      }
    }

    const focus =
      instrumentFocus === 'options' || instrumentFocus === 'futures' ? instrumentFocus : 'all';
    const directiveText =
      typeof directive === 'string' && directive.trim().length > 0
        ? directive.trim()
        : 'Đề xuất danh mục hợp đồng quyền chọn (Options) và hợp đồng tương lai (Futures) tối ưu để phòng hộ VaR và rủi ro đuôi cho danh mục hiện tại.';

    const capitalUsd = Math.max(1000, Number(state.capitalUsd) || 1_000_000);
    const riskSnapshot = {
      capitalUsd,
      nav: state.nav,
      var95Pct: state.var95Pct,
      cvar95Pct: state.cvar95Pct,
      annualVolatilityPct: state.annualVolatilityPct,
      sharpeRatio: state.sharpeRatio,
      geopoliticalRiskIndex: state.geopoliticalRiskIndex,
      oilShockPct: state.oilShockPct,
      policyRate: params.policyRate,
      liquidityInjection: params.liquidityInjection,
      covenantBreaches: state.covenantBreaches ?? [],
      assetRiskBreaches: state.assetRiskBreaches ?? [],
      assetSignals: Array.isArray(state.assetSignals) ? state.assetSignals : [],
      activeDerivatives: Array.isArray(params.activeDerivatives) ? params.activeDerivatives : [],
    };

    const focusInstruction =
      focus === 'options'
        ? 'CHỈ đề xuất các hợp đồng Quyền chọn (put_option hoặc call_option).'
        : focus === 'futures'
          ? 'CHỈ đề xuất các hợp đồng Tương lai (short_futures hoặc long_futures).'
          : 'Đề xuất kết hợp cả Quyền chọn (put_option/call_option) và Hợp đồng Tương lai (short_futures/long_futures).';

    const userPrompt = [
      `Yêu cầu phòng hộ phái sinh: "${directiveText}"`,
      focusInstruction,
      `Hồ sơ rủi ro và vị thế hiện tại của danh mục:\n${JSON.stringify(riskSnapshot)}`,
      'Hãy trả lời bằng tiếng Việt và đề xuất 3 đến 4 hợp đồng phái sinh cụ thể (ưu tiên phòng hộ các lớp tài sản có VaR/biến động cao hoặc đang vượt ngưỡng rủi ro). Tính toán notionalUsd hợp lý theo marketValueUsd từng tài sản, premiumOrMarginUsd thực tế (option premium 1.5-5% notional; futures margin 8-20% notional), và estimatedVarReductionPct (3-18% mỗi hợp đồng).',
    ].join('\n\n');

    const DERIVATIVE_SCHEMA = {
      type: Type.OBJECT,
      properties: {
        riskAssessment: { type: Type.STRING },
        portfolioRiskLevel: { type: Type.STRING },
        recommendedHedgeRatioPct: { type: Type.INTEGER },
        proposals: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              instrumentType: { type: Type.STRING },
              instrumentLabel: { type: Type.STRING },
              underlyingAsset: { type: Type.STRING },
              underlyingLabel: { type: Type.STRING },
              ticker: { type: Type.STRING },
              side: { type: Type.STRING },
              notionalUsd: { type: Type.NUMBER },
              coveragePct: { type: Type.INTEGER },
              strikeOrEntry: { type: Type.STRING },
              expiryDays: { type: Type.INTEGER },
              leverage: { type: Type.INTEGER },
              premiumOrMarginUsd: { type: Type.NUMBER },
              estimatedVarReductionPct: { type: Type.NUMBER },
              proposingAgent: { type: Type.STRING },
              rationale: { type: Type.STRING },
              riskNote: { type: Type.STRING },
            },
            required: [
              'instrumentType',
              'instrumentLabel',
              'underlyingAsset',
              'underlyingLabel',
              'ticker',
              'side',
              'notionalUsd',
              'coveragePct',
              'strikeOrEntry',
              'expiryDays',
              'leverage',
              'premiumOrMarginUsd',
              'estimatedVarReductionPct',
              'proposingAgent',
              'rationale',
              'riskNote',
            ],
          },
        },
      },
      required: [
        'riskAssessment',
        'portfolioRiskLevel',
        'recommendedHedgeRatioPct',
        'proposals',
      ],
    };

    const DERIVATIVE_JSON_GUIDE =
      'Chỉ trả về JSON hợp lệ gồm: riskAssessment (string), portfolioRiskLevel ("THẤP"|"TRUNG BÌNH"|"CAO"|"KHẨN CẤP"), recommendedHedgeRatioPct (10-100), proposals (mảng 3-4 object gồm: instrumentType ("put_option"|"call_option"|"short_futures"|"long_futures"), instrumentLabel (string), underlyingAsset ("equity"|"bond"|"commodity"|"coin"|"memeCoin"|"cash"), underlyingLabel (string), ticker (string), side ("MUA_BẢO_HIỂM"|"BÁN_PHÒNG_HỘ"), notionalUsd (number), coveragePct (10-100), strikeOrEntry (string), expiryDays (7-180), leverage (1-10), premiumOrMarginUsd (number), estimatedVarReductionPct (2-20), proposingAgent (string), rationale (string), riskNote (string)).';

    const runDerivativesForProvider = async (pid: LlmProviderId, modelOverride?: string) => {
      const entry = PROVIDER_REGISTRY[pid];
      const apiKey = getProviderApiKey(pid);
      if (!apiKey) {
        throw Object.assign(new Error(`Chưa cấu hình ${entry.envVarName}.`), { statusCode: 400 });
      }
      const chosenModel =
        modelOverride && entry.availableModels.includes(modelOverride)
          ? modelOverride
          : entry.defaultModel;
      entry.lastCallAtMs = Date.now();

      if (pid === 'gemini') {
        const ai = getGeminiClient(apiKey);
        const resp = await ai.models.generateContent({
          model: chosenModel,
          contents: userPrompt,
          config: {
            systemInstruction:
              'Bạn là Hội đồng Chuyên gia Phái sinh của Agent Swarm (Risk-AI Dept 5, Geo-Vol Dept 2, Lawer-2 Compliance và Center CIO). Nhiệm vụ của bạn là thiết kế các hợp đồng Options (Put/Call) và Futures (Short/Long) chính xác để phòng hộ rủi ro đuôi (VaR/CVaR) của danh mục đầu tư.',
            responseMimeType: 'application/json',
            responseSchema: DERIVATIVE_SCHEMA,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        entry.usedToday += 1;
        return { parsed: extractJsonObject(resp.text ?? '{}'), model: chosenModel };
      }

      if (pid === 'anthropic') {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: chosenModel,
            max_tokens: 1800,
            system: `Bạn là Hội đồng Chuyên gia Phái sinh (Options & Futures Hedging Desk) của Agent Swarm. ${DERIVATIVE_JSON_GUIDE}`,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });
        entry.usedToday += 1;
        if (!resp.ok) {
          const errTxt = await resp.text();
          throw Object.assign(new Error(errTxt || `HTTP ${resp.status}`), {
            statusCode: resp.status,
          });
        }
        const data = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
        const txt = (data.content ?? []).find((b) => b.type === 'text')?.text ?? '{}';
        return { parsed: extractJsonObject(txt), model: chosenModel };
      }

      const endpoint =
        pid === 'openai'
          ? 'https://api.openai.com/v1/chat/completions'
          : 'https://openrouter.ai/api/v1/chat/completions';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
      if (pid === 'openrouter') {
        headers['HTTP-Referer'] = process.env.APP_URL || 'http://localhost:3000';
        headers['X-Title'] = 'FinWorld 3D Agent Swarm';
      }
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: chosenModel,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `Bạn là Hội đồng Chuyên gia Phái sinh (Options & Futures Hedging Desk) của Agent Swarm. ${DERIVATIVE_JSON_GUIDE}`,
            },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      entry.usedToday += 1;
      if (!resp.ok) {
        const errTxt = await resp.text();
        throw Object.assign(new Error(errTxt || `HTTP ${resp.status}`), {
          statusCode: resp.status,
        });
      }
      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return {
        parsed: extractJsonObject(data.choices?.[0]?.message?.content ?? '{}'),
        model: chosenModel,
      };
    };

    try {
      let out: { parsed: Record<string, unknown>; model: string };
      try {
        out = await runDerivativesForProvider(
          activeProvider,
          typeof reqModel === 'string' ? reqModel : undefined,
        );
      } catch (primaryErr: unknown) {
        const formatted = formatProviderError(activeProvider, primaryErr);
        const fb = formatted.status === 429 ? selectFallback(activeProvider) : null;
        if (fb) {
          activeProvider = fb;
          out = await runDerivativesForProvider(fb);
        } else {
          throw primaryErr;
        }
      }

      const p = out.parsed;
      const validRiskLevels = ['THẤP', 'TRUNG BÌNH', 'CAO', 'KHẨN CẤP'] as const;
      const portfolioRiskLevel = validRiskLevels.includes(
        p.portfolioRiskLevel as (typeof validRiskLevels)[number],
      )
        ? (p.portfolioRiskLevel as (typeof validRiskLevels)[number])
        : Number(state.var95Pct) > 15
          ? 'CAO'
          : 'TRUNG BÌNH';

      const validInstrumentTypes = [
        'put_option',
        'call_option',
        'short_futures',
        'long_futures',
      ] as const;
      const validAssets = ['equity', 'bond', 'commodity', 'coin', 'memeCoin', 'cash'] as const;
      const assetLabelsMap: Record<(typeof validAssets)[number], string> = {
        equity: 'Cổ phiếu',
        bond: 'Trái phiếu',
        commodity: 'Vàng & Hàng hóa',
        coin: 'Coin (BTC/ETH)',
        memeCoin: 'Meme Coin',
        cash: 'Tiền mặt USD',
      };

      const rawProposals = Array.isArray(p.proposals) ? p.proposals : [];
      const proposals = rawProposals.slice(0, 5).map((item, idx) => {
        const row = (item ?? {}) as Record<string, unknown>;
        const rawType = validInstrumentTypes.includes(
          row.instrumentType as (typeof validInstrumentTypes)[number],
        )
          ? (row.instrumentType as (typeof validInstrumentTypes)[number])
          : focus === 'futures'
            ? 'short_futures'
            : 'put_option';

        const underlyingAsset = validAssets.includes(
          row.underlyingAsset as (typeof validAssets)[number],
        )
          ? (row.underlyingAsset as (typeof validAssets)[number])
          : 'coin';

        const defaultInstrumentLabel =
          rawType === 'put_option'
            ? 'Quyền chọn Bán (Put Option)'
            : rawType === 'call_option'
              ? 'Quyền chọn Mua (Call Option)'
              : rawType === 'short_futures'
                ? 'Hợp đồng Tương lai Bán (Short Futures)'
                : 'Hợp đồng Tương lai Mua (Long Futures)';

        const side =
          row.side === 'BÁN_PHÒNG_HỘ' || rawType === 'short_futures'
            ? 'BÁN_PHÒNG_HỘ'
            : 'MUA_BẢO_HIỂM';

        const notionalUsd = Math.round(
          clampNumber(row.notionalUsd, 1000, capitalUsd * 0.85, Math.round(capitalUsd * 0.15)),
        );
        const leverage =
          rawType === 'put_option' || rawType === 'call_option'
            ? 1
            : Math.round(clampNumber(row.leverage, 1, 10, 3));
        const defaultCost =
          rawType === 'put_option' || rawType === 'call_option'
            ? Math.round(notionalUsd * 0.032)
            : Math.round(notionalUsd / Math.max(1, leverage) * 0.15);

        return {
          id: `drv-${Date.now()}-${idx}`,
          instrumentType: rawType,
          instrumentLabel:
            typeof row.instrumentLabel === 'string' && row.instrumentLabel.trim()
              ? row.instrumentLabel.trim()
              : defaultInstrumentLabel,
          underlyingAsset,
          underlyingLabel:
            typeof row.underlyingLabel === 'string' && row.underlyingLabel.trim()
              ? row.underlyingLabel.trim()
              : assetLabelsMap[underlyingAsset],
          ticker:
            typeof row.ticker === 'string' && row.ticker.trim()
              ? row.ticker.trim().toUpperCase()
              : `${underlyingAsset.toUpperCase()}-${rawType === 'short_futures' ? 'FUT' : 'OPT'}`,
          side,
          notionalUsd,
          coveragePct: Math.round(clampNumber(row.coveragePct, 10, 100, 45)),
          strikeOrEntry:
            typeof row.strikeOrEntry === 'string' && row.strikeOrEntry.trim()
              ? row.strikeOrEntry.trim()
              : 'At-the-money (ATM)',
          expiryDays: Math.round(clampNumber(row.expiryDays, 7, 180, 30)),
          leverage,
          premiumOrMarginUsd: Math.round(
            clampNumber(row.premiumOrMarginUsd, 100, capitalUsd * 0.35, defaultCost),
          ),
          estimatedVarReductionPct: Number(
            clampNumber(row.estimatedVarReductionPct, 1.5, 22, 6.5).toFixed(1),
          ),
          proposingAgent:
            typeof row.proposingAgent === 'string' && row.proposingAgent.trim()
              ? row.proposingAgent.trim()
              : 'Risk-AI (Dept 5)',
          rationale:
            typeof row.rationale === 'string' && row.rationale.trim()
              ? row.rationale.trim()
              : 'Giảm thiểu tổn thất đuôi khi biến động vĩ mô tăng cao.',
          riskNote:
            typeof row.riskNote === 'string' && row.riskNote.trim()
              ? row.riskNote.trim()
              : 'Theo dõi tỷ lệ ký quỹ và chi phí nắm giữ qua kỳ hạn.',
        };
      });

      res.json({
        runId: `drv-run-${Date.now()}`,
        provider: activeProvider,
        model: out.model,
        latencyMs: Date.now() - startedAt,
        riskAssessment:
          typeof p.riskAssessment === 'string' && p.riskAssessment.trim()
            ? p.riskAssessment.trim()
            : `VaR 95% hiện tại ${state.var95Pct}% cần lớp phòng hộ Options/Futures chủ động.`,
        portfolioRiskLevel,
        recommendedHedgeRatioPct: Math.round(clampNumber(p.recommendedHedgeRatioPct, 10, 100, 50)),
        proposals,
        providers: getAllProviderStatus(),
      });
    } catch (err: unknown) {
      const { status, message } = formatProviderError(activeProvider, err);
      res.status(status).json({
        error: message,
        providers: getAllProviderStatus(),
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('/{*splat}', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        const htmlPath = path.resolve(__dirname, 'index.html');
        const rawHtml = fs.readFileSync(htmlPath, 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(transformed);
      } catch (e) {
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FinWorld 3D + Multi-Provider Agent Swarm server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
