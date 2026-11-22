import React from 'react';
import { ChevronDown, ChevronUp, RotateCcw, Tag } from 'lucide-react';
import { ZONE_METADATA } from '../simulation/financialEngine';
import { SimulationParams, ZoneId } from '../types/finance';

interface ControlDockProps {
  selectedZone: ZoneId;
  collapsed: boolean;
  showLabels: boolean;
  onSelectZone: (zone: ZoneId) => void;
  onToggleCollapse: () => void;
  onToggleLabels: () => void;
  onResetCamera: () => void;
  onApplyScenario: (label: string, patch: Partial<SimulationParams>) => void;
}

const ZONE_ORDER: ZoneId[] = [
  'overview',
  'center',
  'department1',
  'department2',
  'department3',
  'department4',
  'department5',
  'lawer1',
  'lawer2',
];

export const ControlDock: React.FC<ControlDockProps> = ({
  selectedZone,
  collapsed,
  showLabels,
  onSelectZone,
  onToggleCollapse,
  onToggleLabels,
  onResetCamera,
  onApplyScenario,
}) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(980px,95vw)] flex flex-col items-center pointer-events-none">
      {/* Collapse / Expand Handle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="pointer-events-auto mb-1.5 px-3 py-1 rounded-t-lg bg-[#0D1420]/94 border border-b-0 border-white/12 text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
      >
        {collapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
            Mở thanh điều khiển
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
            Thu gọn thanh điều khiển
          </>
        )}
      </button>

      {!collapsed && (
        <div className="pointer-events-auto w-full rounded-xl bg-[#0D1420]/95 border border-white/12 shadow-2xl p-2.5 space-y-2">
          {/* Row 1: Camera & Department Zone Navigation */}
          <div className="flex items-center gap-1 overflow-x-auto custom-scroll pb-0.5">
            {ZONE_ORDER.map((id) => {
              const meta = ZONE_METADATA[id];
              const active = selectedZone === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectZone(id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors ${
                    active
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'bg-[#141D2D] text-slate-300 hover:bg-[#1C283D] hover:text-white'
                  }`}
                >
                  {id !== 'overview' && (
                    <span
                      className="w-1.5 h-1.5 rounded-xs shrink-0"
                      style={{
                        backgroundColor: active ? '#0B111A' : meta.accentHex,
                      }}
                    />
                  )}
                  <span>{meta.shortTitle}</span>
                </button>
              );
            })}
          </div>

          {/* Row 2: Macro Scenario Presets + Viewport Tools */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/8 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-[11px] text-slate-400 whitespace-nowrap mr-1">
                Kịch bản vĩ mô:
              </span>
              <button
                type="button"
                onClick={() =>
                  onApplyScenario('Thị trường ổn định', {
                    warEscalation: 20,
                    policyRate: 4.0,
                    liquidityInjection: 15,
                    fiscalStimulus: 45,
                  })
                }
                className="px-2.5 py-1 rounded-md bg-[#162032] hover:bg-[#1F2D45] text-slate-200 whitespace-nowrap shrink-0"
              >
                Ổn định
              </button>
              <button
                type="button"
                onClick={() =>
                  onApplyScenario('Xung đột leo thang', {
                    warEscalation: 86,
                    commodityHedgePct: 35,
                    policyRate: 5.5,
                    liquidityInjection: -15,
                  })
                }
                className="px-2.5 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 whitespace-nowrap shrink-0"
              >
                Chiến tranh leo thang
              </button>
              <button
                type="button"
                onClick={() =>
                  onApplyScenario('Thắt chặt tiền tệ', {
                    policyRate: 7.5,
                    liquidityInjection: -40,
                    fiscalStimulus: 20,
                    warEscalation: 30,
                  })
                }
                className="px-2.5 py-1 rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 whitespace-nowrap shrink-0"
              >
                Thắt chặt lãi suất
              </button>
              <button
                type="button"
                onClick={() =>
                  onApplyScenario('Bơm thanh khoản QE', {
                    policyRate: 2.25,
                    liquidityInjection: 45,
                    fiscalStimulus: 75,
                    warEscalation: 18,
                  })
                }
                className="px-2.5 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 whitespace-nowrap shrink-0"
              >
                Bơm thanh khoản
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onToggleLabels}
                className={`px-2.5 py-1 rounded-md border flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  showLabels
                    ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                    : 'bg-[#162032] border-white/10 text-slate-300'
                }`}
              >
                <Tag className="w-3 h-3" />
                Nhãn 3D
              </button>
              <button
                type="button"
                onClick={onResetCamera}
                className="px-2.5 py-1 rounded-md bg-[#162032] hover:bg-[#1F2D45] border border-white/10 text-slate-300 hover:text-white flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                Góc nhìn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
