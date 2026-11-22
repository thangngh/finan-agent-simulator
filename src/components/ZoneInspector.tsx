import React, { useState } from 'react';
import { X, ShieldAlert, Scale, TrendingUp, Sliders, FileText, ArrowRight } from 'lucide-react';
import {
  CORPORATE_DOCUMENTS,
  HISTORICAL_REGIMES,
  ZONE_METADATA,
  formatUsd,
  normalizeWeights,
} from '../simulation/financialEngine';
import {
  AssetClassId,
  SimulationParams,
  SimulationState,
  TradeAction,
  ZoneId,
} from '../types/finance';
import {
  CashFlowWaterfallSvg,
  EconomicCausalGraphSvg,
  HistoricalCompareSvg,
  MonteCarloFanSvg,
  NavSparkline,
} from './ZoneCharts';
import { ZoneTrendMiniChart } from './ZoneTrendMiniChart';

interface ZoneInspectorProps {
  zone: Exclude<ZoneId, 'overview'>;
  params: SimulationParams;
  state: SimulationState;
  onUpdateParams: (patch: Partial<SimulationParams>) => void;
  onExecuteDecision: (action: string, detail: string) => void;
  onExecuteTrade: (assetId: AssetClassId, assetLabel: string, action: TradeAction) => void;
  onInitCapital: (capitalUsd: number) => void;
  onSelectZone: (zone: ZoneId) => void;
  onOpenHistory: () => void;
  onClose: () => void;
}

const SliderControl: React.FC<{
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (val: number) => void;
}> = ({ label, valueLabel, min, max, step = 1, value, onChange }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-300">{label}</span>
      <span className="font-mono-tabular font-medium text-amber-300">{valueLabel}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="fin-slider w-full"
    />
  </div>
);

export const ZoneInspector: React.FC<ZoneInspectorProps> = ({
  zone,
  params,
  state,
  onUpdateParams,
  onExecuteDecision,
  onExecuteTrade,
  onInitCapital,
  onSelectZone,
  onOpenHistory,
  onClose,
}) => {
  const meta = ZONE_METADATA[zone];
  const weights = normalizeWeights(params);
  const [selectedGraphNode, setSelectedGraphNode] = useState<string | null>('gdp');

  return (
    <aside
      aria-label={meta.title}
      className="fixed top-16 right-4 bottom-24 z-20 w-[410px] max-w-[92vw] rounded-xl border border-white/12 bg-[#0D1420]/96 shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span
              className="inline-block w-2 h-2 rounded-xs shrink-0"
              style={{ backgroundColor: meta.accentHex }}
            />
            <span className="font-mono-tabular">{meta.code}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{meta.subtitle}</span>
          </div>
          <h2 className="mt-1 text-base font-semibold text-white truncate">{meta.title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng bảng phân tích"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Interactive Content */}
      <div className="flex-1 overflow-y-auto custom-scroll p-5 space-y-5 text-sm">
        <p className="text-xs leading-relaxed text-slate-300">{meta.description}</p>

        {/* Historical Financial Trend Mini-Chart (Recharts) */}
        <ZoneTrendMiniChart zone={zone} history={state.zoneHistory[zone]} />

        {/* CENTER: Investment Decision Nexus */}
        {zone === 'center' && (
          <>
            {/* Live Simulated Capitalization & NAV Card */}
            <div className="rounded-lg border border-white/10 bg-[#121B2B] p-4 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-400">Vốn hóa danh mục giả lập</div>
                  <div className="text-2xl font-semibold font-mono-tabular text-white">
                    {formatUsd(state.capitalUsd)}
                  </div>
                  <div
                    className={`text-[11px] font-mono-tabular ${
                      state.pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {state.pnlUsd >= 0 ? '+' : ''}
                    {formatUsd(state.pnlUsd)} ({state.pnlPct >= 0 ? '+' : ''}
                    {state.pnlPct}%) · NAV {state.nav.toFixed(1)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Khuyến nghị</div>
                  <div
                    className={`text-sm font-semibold ${
                      state.overallTradeAction === 'MUA'
                        ? 'text-emerald-400'
                        : state.overallTradeAction === 'BÁN'
                          ? 'text-rose-400'
                          : 'text-amber-300'
                    }`}
                  >
                    {state.overallTradeAction} · {state.recommendedAction}
                  </div>
                </div>
              </div>

              {/* Init Capital Presets */}
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <div className="text-[11px] text-slate-400">Khởi tạo vốn hóa giả lập (Init Capital)</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { val: 100_000, label: '$100K' },
                    { val: 1_000_000, label: '$1M' },
                    { val: 10_000_000, label: '$10M' },
                    { val: 100_000_000, label: '$100M' },
                  ].map((cap) => (
                    <button
                      key={cap.val}
                      type="button"
                      onClick={() => onInitCapital(cap.val)}
                      className={`py-1 px-2 rounded-md font-mono-tabular text-[11px] border transition-colors ${
                        params.initialCapitalUsd === cap.val
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                          : 'bg-[#0B111A] text-slate-300 border-white/10 hover:bg-white/5'
                      }`}
                    >
                      {cap.label}
                    </button>
                  ))}
                </div>
              </div>

              <NavSparkline history={state.navHistory} accent="#F59E0B" />
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-xs">
                <div>
                  <div className="text-slate-400">Kỳ vọng/năm</div>
                  <div className="font-mono-tabular font-semibold text-emerald-400">
                    {state.expectedReturnPct >= 0 ? '+' : ''}
                    {state.expectedReturnPct}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Biến động</div>
                  <div className="font-mono-tabular font-semibold text-slate-100">
                    {state.annualVolatilityPct}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Điểm tin cậy</div>
                  <div className="font-mono-tabular font-semibold text-amber-300">
                    {state.convictionScore}/100
                  </div>
                </div>
              </div>
            </div>

            {/* Buy / Hold / Sell Live Asset Decisions + Max Risk Threshold Config */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-200">
                  Quyết định &amp; Ngưỡng Rủi Ro Tối Đa theo lớp tài sản
                </h3>
                {state.assetRiskBreaches.length > 0 && (
                  <span className="font-mono-tabular text-[11px] font-semibold text-rose-400">
                    {state.assetRiskBreaches.length} vượt ngưỡng
                  </span>
                )}
              </div>
              <div className="divide-y divide-white/8 rounded-lg border border-white/10 bg-[#111927]">
                {state.assetSignals.map((asset) => {
                  const sigColor =
                    asset.action === 'MUA'
                      ? 'text-emerald-400'
                      : asset.action === 'BÁN'
                        ? 'text-rose-400'
                        : 'text-amber-300';
                  return (
                    <div
                      key={asset.id}
                      className={`p-2.5 text-xs space-y-1.5 transition-colors ${
                        asset.riskBreached ? 'bg-rose-950/35' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-1.5">
                          <span className="font-semibold text-white truncate">{asset.label}</span>
                          <span className="font-mono-tabular text-[11px] text-slate-400 shrink-0">
                            {asset.ticker} · {asset.weightPct}%
                          </span>
                        </div>
                        <div className="text-right font-mono-tabular shrink-0">
                          <span className="text-slate-100">{formatUsd(asset.marketValueUsd)}</span>
                          <span
                            className={`ml-1.5 text-[11px] ${
                              asset.tickChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {asset.tickChangePct >= 0 ? '+' : ''}
                            {asset.tickChangePct}%
                          </span>
                        </div>
                      </div>

                      {/* Live Asset Volatility / VaR vs Configurable Max Risk Threshold */}
                      <div className="flex items-center justify-between gap-2 text-[10.5px]">
                        <div className="font-mono-tabular text-slate-300 flex items-center gap-1.5 min-w-0">
                          <span>
                            Vol{' '}
                            <strong
                              className={
                                asset.volatilityPct > asset.maxRiskThresholdPct
                                  ? 'text-rose-400'
                                  : 'text-slate-100'
                              }
                            >
                              {asset.volatilityPct}%
                            </strong>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            VaR{' '}
                            <strong
                              className={
                                asset.var95Pct > asset.maxRiskThresholdPct
                                  ? 'text-rose-400'
                                  : 'text-slate-100'
                              }
                            >
                              {asset.var95Pct}%
                            </strong>
                          </span>
                          {asset.riskBreached && (
                            <span className="text-rose-400 font-semibold whitespace-nowrap">
                              · VƯỢT NGƯỠNG
                            </span>
                          )}
                        </div>

                        <label className="flex items-center gap-1 text-slate-400 shrink-0">
                          <span>Ngưỡng tối đa:</span>
                          <input
                            type="number"
                            min={1}
                            max={150}
                            step={1}
                            aria-label={`Ngưỡng Rủi Ro Tối Đa cho ${asset.label}`}
                            value={params.assetRiskThresholds[asset.id]}
                            onChange={(e) => {
                              const raw = Number(e.target.value);
                              if (!Number.isFinite(raw)) return;
                              const clamped = Math.max(1, Math.min(150, Math.round(raw)));
                              onUpdateParams({
                                assetRiskThresholds: {
                                  ...params.assetRiskThresholds,
                                  [asset.id]: clamped,
                                },
                              });
                            }}
                            className={`w-13 rounded border px-1.5 py-0.5 text-right font-mono-tabular text-[11px] focus:outline-none ${
                              asset.riskBreached
                                ? 'border-rose-400/70 bg-rose-950/60 text-rose-100 focus:border-rose-300'
                                : 'border-white/15 bg-[#080D15] text-amber-300 focus:border-amber-400'
                            }`}
                          />
                          <span className="font-mono-tabular">%</span>
                        </label>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] text-slate-400 truncate">
                          Tín hiệu <strong className={sigColor}>{asset.action}</strong> ·{' '}
                          {asset.reason}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {(['MUA', 'GIỮ', 'BÁN'] as TradeAction[]).map((act) => (
                            <button
                              key={act}
                              type="button"
                              onClick={() => onExecuteTrade(asset.id, asset.label, act)}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                                act === 'MUA'
                                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/30'
                                  : act === 'BÁN'
                                    ? 'border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/30'
                                    : 'border-amber-500/35 bg-amber-500/10 text-amber-200 hover:bg-amber-500/25'
                              }`}
                            >
                              {act}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interactive 6-Asset Allocation Controls (including Coin & Meme Coin) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  Tương tác phân bổ danh mục
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateParams({
                      hedgingActive: !params.hedgingActive,
                    })
                  }
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    params.hedgingActive
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                      : 'bg-slate-800 border-white/10 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {params.hedgingActive ? 'Đang bật Phòng hộ' : 'Bật Phòng hộ (Hedge)'}
                </button>
              </div>

              <SliderControl
                label="Cổ phiếu (Equity)"
                valueLabel={`${Math.round(weights.eq * 100)}%`}
                min={5}
                max={80}
                value={params.equityWeight}
                onChange={(v) => onUpdateParams({ equityWeight: v })}
              />
              <SliderControl
                label="Trái phiếu (Bonds)"
                valueLabel={`${Math.round(weights.bd * 100)}%`}
                min={5}
                max={70}
                value={params.bondWeight}
                onChange={(v) => onUpdateParams({ bondWeight: v })}
              />
              <SliderControl
                label="Vàng & Hàng hóa (Commodities)"
                valueLabel={`${Math.round(weights.cm * 100)}%`}
                min={0}
                max={55}
                value={params.commodityWeight}
                onChange={(v) => onUpdateParams({ commodityWeight: v })}
              />
              <SliderControl
                label="Coin (BTC / ETH / SOL)"
                valueLabel={`${Math.round(weights.coin * 100)}%`}
                min={0}
                max={45}
                value={params.coinWeight}
                onChange={(v) => onUpdateParams({ coinWeight: v })}
              />
              <SliderControl
                label="Meme Coin (DOGE / PEPE)"
                valueLabel={`${Math.round(weights.meme * 100)}%`}
                min={0}
                max={25}
                value={params.memeCoinWeight}
                onChange={(v) => onUpdateParams({ memeCoinWeight: v })}
              />
              <SliderControl
                label="Tiền mặt (Cash)"
                valueLabel={`${Math.round(weights.ca * 100)}%`}
                min={0}
                max={60}
                value={params.cashWeight}
                onChange={(v) => onUpdateParams({ cashWeight: v })}
              />
            </div>

            {/* Real-Time Decision Execution */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onUpdateParams({
                    equityWeight: 42,
                    bondWeight: 18,
                    commodityWeight: 10,
                    coinWeight: 18,
                    memeCoinWeight: 6,
                    cashWeight: 6,
                    hedgingActive: false,
                  });
                  onExecuteDecision(
                    'MUA Tăng trưởng + Crypto',
                    'Tăng tỷ trọng Cổ phiếu (42%), Coin (18%), Meme Coin (6%).',
                  );
                }}
                className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
              >
                MUA Tăng trưởng
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateParams({
                    equityWeight: 20,
                    bondWeight: 38,
                    commodityWeight: 20,
                    coinWeight: 4,
                    memeCoinWeight: 0,
                    cashWeight: 18,
                    hedgingActive: true,
                  });
                  onExecuteDecision(
                    'BÁN Giảm rủi ro & Phòng thủ',
                    'Thoát Meme Coin, giảm Coin còn 4%, bật Hedge & tăng Trái phiếu.',
                  );
                }}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/15 text-slate-100 font-semibold text-xs transition-colors"
              >
                BÁN Phòng thủ
              </button>
            </div>

            {/* Aggregated Department Signal Matrix */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-200">
                Tín hiệu tổng hợp từ 7 phân khu
              </h3>
              <div className="divide-y divide-white/8 rounded-lg border border-white/10 bg-[#111927]">
                {[
                  {
                    id: 'department1' as ZoneId,
                    name: 'Dept 1 · Dòng tiền FCF',
                    val: `${state.freeCashFlow >= 0 ? '+' : ''}${state.freeCashFlow}M`,
                    ok: state.freeCashFlow > 20,
                  },
                  {
                    id: 'department2' as ZoneId,
                    name: 'Dept 2 · Chiến tranh',
                    val: `${state.geopoliticalRiskIndex}/100`,
                    ok: state.geopoliticalRiskIndex < 55,
                  },
                  {
                    id: 'department4' as ZoneId,
                    name: 'Dept 4 · Vĩ mô GDP/CPI',
                    val: `${state.gdpGrowthPct.toFixed(1)}% / ${state.inflationPct.toFixed(1)}%`,
                    ok: state.gdpGrowthPct > 1.5 && state.inflationPct < 5,
                  },
                  {
                    id: 'department5' as ZoneId,
                    name: 'Dept 5 · Sharpe & VaR',
                    val: `${state.sharpeRatio} · -${state.var95Pct}%`,
                    ok: state.sharpeRatio > 0.4,
                  },
                  {
                    id: 'lawer1' as ZoneId,
                    name: 'Law-er-1 · Pháp lý HS',
                    val: `${state.legalRiskScore}/100`,
                    ok: state.legalRiskScore < 50,
                  },
                  {
                    id: 'lawer2' as ZoneId,
                    name: 'Lawer-2 · Rủi ro ĐT',
                    val: `${state.investmentRiskScore}/100`,
                    ok: state.covenantBreaches.length === 0,
                  },
                ].map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => onSelectZone(row.id)}
                    className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-white/5 transition-colors text-left"
                  >
                    <span className="text-slate-300 flex items-center gap-1.5">
                      {row.name}
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                    </span>
                    <span
                      className={`font-mono-tabular font-medium ${
                        row.ok ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {row.val}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Decision Log */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-300">Nhật ký quyết định gần đây</div>
                <button
                  type="button"
                  onClick={onOpenHistory}
                  className="text-[11px] font-medium text-amber-300 hover:text-amber-200 transition-colors"
                >
                  Xem toàn bộ ({state.decisionLog.length})
                </button>
              </div>
              <div className="space-y-1.5">
                {state.decisionLog.slice(0, 3).map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-md bg-[#121B2B] px-3 py-2 text-xs border border-white/8"
                  >
                    <div className="flex justify-between font-medium text-slate-100">
                      <span>{entry.action}</span>
                      <span className="font-mono-tabular text-slate-400">T+{entry.tick}</span>
                    </div>
                    <div className="text-slate-400 mt-0.5">{entry.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* DEPARTMENT 1: Cash Flow */}
        {zone === 'department1' && (
          <>
            <div className="rounded-lg border border-white/10 bg-[#121B2B] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Thác lưu chuyển tiền tệ (Cash Flow)</span>
                <span className="font-mono-tabular text-emerald-400">
                  Runway: {state.cashRunwayMonths} tháng
                </span>
              </div>
              <CashFlowWaterfallSvg state={state} />
            </div>

            <div className="space-y-4">
              <SliderControl
                label="Tỷ lệ tái đầu tư (CapEx / OCF)"
                valueLabel={`${params.reinvestmentRate}%`}
                min={10}
                max={80}
                value={params.reinvestmentRate}
                onChange={(v) => onUpdateParams({ reinvestmentRate: v })}
              />
              <SliderControl
                label="Kỳ thu tiền bình quân (DSO)"
                valueLabel={`${params.receivableDays} ngày`}
                min={20}
                max={110}
                value={params.receivableDays}
                onChange={(v) => onUpdateParams({ receivableDays: v })}
              />
            </div>

            <div className="rounded-lg border border-white/10 bg-[#111927] p-3.5 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Dòng tiền hoạt động (OCF)</span>
                <span className="font-mono-tabular text-slate-100">${state.operatingCashFlow}M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dòng tiền tự do (FCF)</span>
                <span
                  className={`font-mono-tabular font-semibold ${
                    state.freeCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  ${state.freeCashFlow}M
                </span>
              </div>
            </div>
          </>
        )}

        {/* DEPARTMENT 2: War & Geopolitical Volatility */}
        {zone === 'department2' && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-white/10 bg-[#121B2B] p-3">
                <div className="text-xs text-slate-400">Chỉ số Địa chính trị</div>
                <div className="mt-1 text-xl font-semibold font-mono-tabular text-rose-400">
                  {state.geopoliticalRiskIndex}/100
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#121B2B] p-3">
                <div className="text-xs text-slate-400">Cú sốc Năng lượng</div>
                <div className="mt-1 text-xl font-semibold font-mono-tabular text-amber-300">
                  +{state.oilShockPct}%
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#121B2B] p-3">
                <div className="text-xs text-slate-400">Áp lực Chuỗi cung ứng</div>
                <div className="mt-1 text-lg font-semibold font-mono-tabular text-slate-100">
                  {state.supplyChainStress}%
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#121B2B] p-3">
                <div className="text-xs text-slate-400">Biến động cộng thêm</div>
                <div className="mt-1 text-lg font-semibold font-mono-tabular text-rose-300">
                  +{state.warVolContribution}%
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <SliderControl
                label="Mức độ leo thang xung đột"
                valueLabel={`${params.warEscalation}/100`}
                min={0}
                max={100}
                value={params.warEscalation}
                onChange={(v) => onUpdateParams({ warEscalation: v })}
              />
              <SliderControl
                label="Tỷ lệ phòng hộ Hàng hóa / Vàng"
                valueLabel={`${params.commodityHedgePct}%`}
                min={0}
                max={100}
                value={params.commodityHedgePct}
                onChange={(v) => onUpdateParams({ commodityHedgePct: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateParams({ warEscalation: 85, commodityHedgePct: 30 })}
                className="px-3 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-xs font-medium"
              >
                Mô phỏng Xung đột cao
              </button>
              <button
                type="button"
                onClick={() => onUpdateParams({ warEscalation: 15, commodityHedgePct: 60 })}
                className="px-3 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 text-xs font-medium"
              >
                Hạ nhiệt Địa chính trị
              </button>
            </div>
          </>
        )}

        {/* DEPARTMENT 3: Historical Volatility */}
        {zone === 'department3' && (
          <>
            <div className="rounded-lg border border-white/10 bg-[#121B2B] p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-sky-300 font-medium">
                  {HISTORICAL_REGIMES[params.selectedRegimeId].name}
                </span>
                <span className="font-mono-tabular text-slate-400">
                  Tương đồng: {state.historicalMatchSimilarity}%
                </span>
              </div>
              <HistoricalCompareSvg
                selectedRegimeId={params.selectedRegimeId}
                navHistory={state.navHistory}
              />
              <div className="flex items-center gap-4 text-[11px] text-slate-400">
                <span className="text-sky-300">━ Đường lịch sử (Base 100)</span>
                <span className="text-amber-300">┄ Quỹ đạo hiện tại</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-300">Chọn chu kỳ lịch sử đối chiếu</div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  Object.keys(HISTORICAL_REGIMES) as SimulationParams['selectedRegimeId'][]
                ).map((regId) => {
                  const reg = HISTORICAL_REGIMES[regId];
                  const active = params.selectedRegimeId === regId;
                  return (
                    <button
                      key={regId}
                      type="button"
                      onClick={() => onUpdateParams({ selectedRegimeId: regId })}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                        active
                          ? 'bg-sky-500/20 border-sky-400 text-white'
                          : 'bg-[#111927] border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="font-semibold truncate">{reg.period}</div>
                      <div className="font-mono-tabular text-[11px] text-slate-400 mt-0.5">
                        Đỉnh giảm {reg.peakDropPct}% · {reg.recoveryMonths}T
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <SliderControl
              label="Cửa sổ hồi cứu (Lookback)"
              valueLabel={`${params.lookbackMonths} tháng`}
              min={12}
              max={60}
              step={6}
              value={params.lookbackMonths}
              onChange={(v) => onUpdateParams({ lookbackMonths: v })}
            />
          </>
        )}

        {/* DEPARTMENT 4: Macro Regulation & Interactive Visual Economic Graph */}
        {zone === 'department4' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-indigo-300">
                  Đồ thị nhân quả điều tiết vĩ mô
                </span>
                <span className="text-slate-400">Nhấp nút để xem chi tiết</span>
              </div>
              <EconomicCausalGraphSvg
                nodes={state.economicNodes}
                selectedNodeId={selectedGraphNode}
                onSelectNode={setSelectedGraphNode}
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="text-emerald-400">→ Tác động thuận chiều (+)</span>
                <span className="text-rose-400">⇢ Tác động nghịch chiều (-)</span>
              </div>
            </div>

            {selectedGraphNode && (
              <div className="rounded-lg border border-indigo-400/25 bg-[#121B2B] px-3.5 py-2.5 text-xs flex items-center justify-between">
                {(() => {
                  const found = state.economicNodes.find((n) => n.id === selectedGraphNode);
                  if (!found) return null;
                  return (
                    <>
                      <span className="text-slate-200 font-medium">{found.label}</span>
                      <span className="font-mono-tabular text-indigo-300 font-semibold">
                        {found.displayValue} · Sức ảnh hưởng {found.value}/100
                      </span>
                    </>
                  );
                })()}
              </div>
            )}

            <div className="space-y-3.5">
              <SliderControl
                label="Lãi suất điều hành (Policy Rate)"
                valueLabel={`${params.policyRate.toFixed(1)}%`}
                min={1.0}
                max={9.0}
                step={0.25}
                value={params.policyRate}
                onChange={(v) => onUpdateParams({ policyRate: v })}
              />
              <SliderControl
                label="Bơm / Hút thanh khoản (QE / QT)"
                valueLabel={`${params.liquidityInjection >= 0 ? '+' : ''}${params.liquidityInjection}B`}
                min={-50}
                max={50}
                step={5}
                value={params.liquidityInjection}
                onChange={(v) => onUpdateParams({ liquidityInjection: v })}
              />
              <SliderControl
                label="Kích thích tài khóa (Fiscal Stimulus)"
                valueLabel={`${params.fiscalStimulus}/100`}
                min={0}
                max={100}
                value={params.fiscalStimulus}
                onChange={(v) => onUpdateParams({ fiscalStimulus: v })}
              />
            </div>
          </>
        )}

        {/* DEPARTMENT 5: Portfolio Risk & Monte Carlo Forecast */}
        {zone === 'department5' && (
          <>
            <div className="rounded-lg border border-white/10 bg-[#121B2B] p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-teal-300 font-medium">Dự báo Monte Carlo 24 tháng</span>
                <span className="font-mono-tabular text-slate-400">P10 / P50 / P90</span>
              </div>
              <MonteCarloFanSvg
                paths={state.monteCarloPaths}
                stopLossPct={params.stopLossThreshold}
                currentNav={state.nav}
              />
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-xs">
                <div>
                  <div className="text-slate-400">VaR (95%)</div>
                  <div className="font-mono-tabular font-semibold text-rose-400">
                    -{state.var95Pct}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">CVaR (Tail)</div>
                  <div className="font-mono-tabular font-semibold text-orange-300">
                    -{state.cvar95Pct}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Sharpe</div>
                  <div className="font-mono-tabular font-semibold text-teal-300">
                    {state.sharpeRatio}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <SliderControl
                label="Biến động mục tiêu (Target Vol)"
                valueLabel={`${params.targetVolatility}%`}
                min={6}
                max={28}
                value={params.targetVolatility}
                onChange={(v) => onUpdateParams({ targetVolatility: v })}
              />
              <SliderControl
                label="Ngưỡng cắt lỗ tự động (Stop-Loss)"
                valueLabel={`-${params.stopLossThreshold}%`}
                min={5}
                max={25}
                value={params.stopLossThreshold}
                onChange={(v) => onUpdateParams({ stopLossThreshold: v })}
              />
            </div>

            {/* Per-Asset Max Risk Threshold Config in Dept 5 */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">
                  Ngưỡng Rủi Ro Tối Đa từng lớp tài sản
                </span>
                <span className="text-[11px] text-slate-400 font-mono-tabular">
                  VaR / Biến động
                </span>
              </div>
              <div className="divide-y divide-white/8 rounded-lg border border-white/10 bg-[#111927]">
                {state.assetSignals.map((asset) => (
                  <div
                    key={asset.id}
                    className={`px-3 py-2 flex items-center justify-between gap-2 text-xs ${
                      asset.riskBreached ? 'bg-rose-950/35' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-100 truncate">
                        {asset.label}{' '}
                        <span className="font-mono-tabular text-[10.5px] text-slate-400">
                          ({asset.ticker})
                        </span>
                      </div>
                      <div className="font-mono-tabular text-[10.5px] text-slate-400">
                        Vol {asset.volatilityPct}% · VaR {asset.var95Pct}%
                        {asset.riskBreached && (
                          <span className="ml-1.5 text-rose-400 font-semibold">VƯỢT NGƯỠNG</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={150}
                        step={1}
                        aria-label={`Ngưỡng Rủi Ro Tối Đa cho ${asset.label}`}
                        value={params.assetRiskThresholds[asset.id]}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          if (!Number.isFinite(raw)) return;
                          const clamped = Math.max(1, Math.min(150, Math.round(raw)));
                          onUpdateParams({
                            assetRiskThresholds: {
                              ...params.assetRiskThresholds,
                              [asset.id]: clamped,
                            },
                          });
                        }}
                        className={`w-14 rounded border px-1.5 py-1 text-right font-mono-tabular text-xs focus:outline-none ${
                          asset.riskBreached
                            ? 'border-rose-400/70 bg-rose-950/60 text-rose-100'
                            : 'border-white/15 bg-[#080D15] text-amber-300'
                        }`}
                      />
                      <span className="font-mono-tabular text-[11px] text-slate-400">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* LAW-ER-1: Corporate Legal Document Risk Analyzer */}
        {zone === 'lawer1' && (
          <>
            <div className="rounded-lg border border-white/10 bg-[#121B2B] p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-amber-400" />
                  Điểm rủi ro pháp lý hồ sơ
                </div>
                <div className="mt-1 text-2xl font-semibold font-mono-tabular text-amber-300">
                  {state.legalRiskScore}
                  <span className="text-xs text-slate-400 font-normal"> / 100</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Chiết khấu định giá</div>
                <div className="mt-1 text-base font-semibold font-mono-tabular text-rose-400">
                  -{state.legalHaircutPct}%/năm
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                Chọn giấy tờ công ty cần thẩm định
              </div>
              <div className="space-y-1.5">
                {CORPORATE_DOCUMENTS.map((doc) => {
                  const active = params.selectedDocId === doc.id;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() =>
                        onUpdateParams({
                          selectedDocId: doc.id,
                          customDocText: doc.excerpt,
                        })
                      }
                      className={`w-full p-2.5 rounded-lg border text-left text-xs transition-colors ${
                        active
                          ? 'bg-amber-500/15 border-amber-400/60 text-white'
                          : 'bg-[#111927] border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="font-semibold">{doc.company}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {doc.title} · {doc.docType}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="legal-doc-textarea"
                className="block text-xs font-medium text-slate-300"
              >
                Nội dung trích xuất từ hồ sơ công ty (có thể chỉnh sửa trực tiếp)
              </label>
              <textarea
                id="legal-doc-textarea"
                rows={4}
                value={params.customDocText}
                onChange={(e) => onUpdateParams({ customDocText: e.target.value })}
                className="w-full rounded-lg border border-white/15 bg-[#080D15] p-2.5 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-300">
                Điều khoản rủi ro phát hiện ({state.flaggedClauses.length})
              </div>
              {state.flaggedClauses.length === 0 ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  Không phát hiện điều khoản kiện tụng, vỡ nợ chéo hay lưu ý kiểm toán bất thường.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {state.flaggedClauses.map((flag) => (
                    <div
                      key={flag.keyword}
                      className="rounded-lg border border-white/10 bg-[#111927] p-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between font-medium">
                        <span
                          className={
                            flag.severity === 'high' ? 'text-rose-400' : 'text-amber-300'
                          }
                        >
                          {flag.keyword}
                        </span>
                        <span className="font-mono-tabular text-slate-400">
                          +{flag.impactPoints} điểm · {flag.category}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-400">{flag.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* LAWER-2: Investment Risk & Covenants */}
        {zone === 'lawer2' && (
          <>
            <div className="rounded-lg border border-white/10 bg-[#121B2B] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
                  Tổng hợp Rủi ro Đầu tư
                </div>
                <div className="text-xl font-semibold font-mono-tabular text-orange-300">
                  {state.investmentRiskScore}/100
                </div>
              </div>

              {[
                { label: 'Rủi ro tập trung (Concentration)', val: state.concentrationRiskScore },
                { label: 'Rủi ro thanh khoản (Liquidity)', val: state.liquidityRiskScore },
                { label: 'Rủi ro đối tác (Counterparty)', val: state.counterpartyRiskScore },
              ].map((axis) => (
                <div key={axis.label} className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>{axis.label}</span>
                    <span className="font-mono-tabular">{axis.val}/100</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-sm overflow-hidden">
                    <div
                      className="h-full transition-all duration-200"
                      style={{
                        width: `${axis.val}%`,
                        backgroundColor:
                          axis.val > 65 ? '#EF4444' : axis.val > 40 ? '#FB923C' : '#10B981',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3.5">
              <SliderControl
                label="Trần sụt giảm tối đa (Max Drawdown)"
                valueLabel={`${params.maxDrawdownLimit}%`}
                min={8}
                max={30}
                value={params.maxDrawdownLimit}
                onChange={(v) => onUpdateParams({ maxDrawdownLimit: v })}
              />
              <SliderControl
                label="Giới hạn tập trung 1 lớp tài sản"
                valueLabel={`${params.maxConcentrationPct}%`}
                min={25}
                max={80}
                value={params.maxConcentrationPct}
                onChange={(v) => onUpdateParams({ maxConcentrationPct: v })}
              />
              <div className="space-y-1.5">
                <div className="text-xs text-slate-300">Xếp hạng đối tác lưu ký</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'tier1' as const, label: 'Tier-1 AAA' },
                    { id: 'mixed' as const, label: 'Hỗn hợp' },
                    { id: 'emerging' as const, label: 'Mới nổi' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onUpdateParams({ counterpartyTier: t.id })}
                      className={`py-1.5 px-2 rounded-md text-xs border transition-colors ${
                        params.counterpartyTier === t.id
                          ? 'bg-orange-500/20 border-orange-400 text-white'
                          : 'bg-[#111927] border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
                Giám sát vi phạm hạn mức ({state.covenantBreaches.length})
              </div>
              {state.covenantBreaches.length === 0 ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  Toàn bộ hạn mức đầu tư (Covenants) đang tuân thủ an toàn.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {state.covenantBreaches.map((breach) => (
                    <div
                      key={breach}
                      className="rounded-lg border border-rose-500/35 bg-rose-500/15 p-2.5 text-xs text-rose-200"
                    >
                      {breach}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
