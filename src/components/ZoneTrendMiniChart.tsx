import React from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ZoneId, ZoneTrendPoint } from '../types/finance';

type ActiveZone = Exclude<ZoneId, 'overview'>;

interface ZoneSeriesConfig {
  title: string;
  primaryLabel: string;
  primaryUnit: string;
  primaryColor: string;
  secondaryLabel: string;
  secondaryUnit: string;
  secondaryColor: string;
}

const ZONE_CHART_CONFIG: Record<ActiveZone, ZoneSeriesConfig> = {
  center: {
    title: 'Xu hướng NAV & Điểm tin cậy Center',
    primaryLabel: 'NAV',
    primaryUnit: '',
    primaryColor: '#F59E0B',
    secondaryLabel: 'Tin cậy',
    secondaryUnit: '/100',
    secondaryColor: '#38BDF8',
  },
  department1: {
    title: 'Lịch sử Dòng tiền FCF & OCF',
    primaryLabel: 'Free Cash Flow',
    primaryUnit: 'M',
    primaryColor: '#10B981',
    secondaryLabel: 'Operating CF',
    secondaryUnit: 'M',
    secondaryColor: '#38BDF8',
  },
  department2: {
    title: 'Diễn biến Chỉ số Chiến tranh & Sốc dầu',
    primaryLabel: 'Địa chính trị',
    primaryUnit: '/100',
    primaryColor: '#EF4444',
    secondaryLabel: 'Sốc dầu',
    secondaryUnit: '%',
    secondaryColor: '#F59E0B',
  },
  department3: {
    title: 'Lịch sử Sụt giảm & Độ tương đồng',
    primaryLabel: 'Drawdown',
    primaryUnit: '%',
    primaryColor: '#38BDF8',
    secondaryLabel: 'Tương đồng',
    secondaryUnit: '%',
    secondaryColor: '#A78BFA',
  },
  department4: {
    title: 'Quỹ đạo Tăng trưởng GDP & Lạm phát',
    primaryLabel: 'GDP',
    primaryUnit: '%',
    primaryColor: '#10B981',
    secondaryLabel: 'Lạm phát',
    secondaryUnit: '%',
    secondaryColor: '#F43F5E',
  },
  department5: {
    title: 'Lịch sử Biến động & VaR 95%',
    primaryLabel: 'Biến động/năm',
    primaryUnit: '%',
    primaryColor: '#2DD4BF',
    secondaryLabel: 'VaR 95%',
    secondaryUnit: '%',
    secondaryColor: '#FB7185',
  },
  lawer1: {
    title: 'Xu hướng Rủi ro Pháp lý Hồ sơ',
    primaryLabel: 'Điểm pháp lý',
    primaryUnit: '/100',
    primaryColor: '#FBBF24',
    secondaryLabel: 'Chiết khấu x10',
    secondaryUnit: 'bps',
    secondaryColor: '#FB7185',
  },
  lawer2: {
    title: 'Lịch sử Rủi ro Đầu tư & Thanh khoản',
    primaryLabel: 'Rủi ro ĐT',
    primaryUnit: '/100',
    primaryColor: '#FB923C',
    secondaryLabel: 'Thanh khoản',
    secondaryUnit: '/100',
    secondaryColor: '#38BDF8',
  },
};

export const ZoneTrendMiniChart: React.FC<{
  zone: ActiveZone;
  history: ZoneTrendPoint[];
}> = ({ zone, history }) => {
  const cfg = ZONE_CHART_CONFIG[zone];
  const latest = history[history.length - 1];
  const gradId = `zoneGrad-${zone}`;

  return (
    <div className="rounded-lg border border-white/10 bg-[#111927] p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-200 truncate">{cfg.title}</span>
        {latest && (
          <div className="flex items-center gap-2 text-[11px] font-mono-tabular shrink-0">
            <span style={{ color: cfg.primaryColor }}>
              {latest.primary}
              {cfg.primaryUnit}
            </span>
            <span className="text-slate-600" aria-hidden="true">
              /
            </span>
            <span style={{ color: cfg.secondaryColor }}>
              {latest.secondary}
              {cfg.secondaryUnit}
            </span>
          </div>
        )}
      </div>

      <div className="w-full h-32">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={history} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={cfg.primaryColor} stopOpacity={0.32} />
                <stop offset="95%" stopColor={cfg.primaryColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748B', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              minTickGap={18}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#64748B', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
            />
            <YAxis yAxisId="right" orientation="right" hide domain={['auto', 'auto']} />
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
                const val = Array.isArray(value) ? value.join(', ') : (value ?? '');
                const labelName = String(name ?? '');
                if (labelName === cfg.primaryLabel) {
                  return [`${val}${cfg.primaryUnit}`, cfg.primaryLabel];
                }
                return [`${val}${cfg.secondaryUnit}`, cfg.secondaryLabel];
              }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="primary"
              name={cfg.primaryLabel}
              stroke={cfg.primaryColor}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              isAnimationActive={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="secondary"
              name={cfg.secondaryLabel}
              stroke={cfg.secondaryColor}
              strokeWidth={1.6}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-0.5"
            style={{ backgroundColor: cfg.primaryColor }}
          />
          {cfg.primaryLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-0.5"
            style={{ backgroundColor: cfg.secondaryColor }}
          />
          {cfg.secondaryLabel}
        </span>
      </div>
    </div>
  );
};
