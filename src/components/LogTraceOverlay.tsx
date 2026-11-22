import React, { useState } from 'react';
import { AlertTriangle, Bot, ChevronDown, ChevronUp, Terminal, Trash2 } from 'lucide-react';
import { TraceLogEntry, TradeAction } from '../types/finance';

interface LogTraceOverlayProps {
  logs: TraceLogEntry[];
  visible: boolean;
  onClear: () => void;
  onTriggerUrgentSwarm?: () => void;
}

function getActionStyle(
  action?: TradeAction,
  category?: TraceLogEntry['category'],
  severity?: TraceLogEntry['severity'],
): string {
  if (severity === 'critical') return 'text-rose-400';
  if (action === 'MUA') return 'text-emerald-400';
  if (action === 'BÁN') return 'text-rose-400';
  if (action === 'GIỮ') return 'text-amber-300';
  if (category === 'tool') return 'text-cyan-300';
  if (category === 'dialogue') return 'text-fuchsia-300';
  if (category === 'swarm') return 'text-sky-300';
  if (category === 'risk') return 'text-orange-300';
  return 'text-slate-300';
}

function getTagLabel(entry: TraceLogEntry): string {
  if (entry.severity === 'critical') return 'CẢNH BÁO ĐỎ';
  if (entry.tradeAction) return entry.tradeAction;
  switch (entry.category) {
    case 'init':
      return 'INIT';
    case 'tool':
      return 'TOOL';
    case 'dialogue':
      return 'THẢO LUẬN';
    case 'swarm':
      return 'SWARM';
    case 'risk':
      return 'RISK';
    case 'trade':
      return 'LỆNH';
    default:
      return 'TRACE';
  }
}

export const LogTraceOverlay: React.FC<LogTraceOverlayProps> = ({
  logs,
  visible,
  onClear,
  onTriggerUrgentSwarm,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  if (!visible) return null;

  const displayed = showAll ? logs.slice(0, 14) : logs.slice(0, 5);
  const criticalCount = logs.filter((l) => l.severity === 'critical').length;

  return (
    <section
      aria-label="Thông báo Log Trace"
      className="fixed top-16 left-4 z-20 w-[355px] max-w-[88vw] rounded-xl border border-white/12 bg-[#0D1420]/94 shadow-xl overflow-hidden"
    >
      {/* Header Bar */}
      <div className="px-3.5 py-2 border-b border-white/10 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
        >
          <Terminal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Log Trace</span>
          <span className="font-mono-tabular text-[11px] font-normal text-slate-400">
            · {logs.length} sự kiện
            {criticalCount > 0 && (
              <span className="ml-1 text-rose-400 font-semibold">· {criticalCount} đỏ</span>
            )}
          </span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>

        <div className="flex items-center gap-1.5">
          {expanded && logs.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
            >
              {showAll ? 'Thu gọn' : 'Xem thêm'}
            </button>
          )}
          <button
            type="button"
            onClick={onClear}
            title="Xóa log trace"
            className="p-1 rounded text-slate-400 hover:text-rose-300 hover:bg-white/8 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Trace Stream */}
      {expanded && (
        <div className="max-h-68 overflow-y-auto custom-scroll divide-y divide-white/6">
          {displayed.length === 0 ? (
            <div className="px-3.5 py-3 text-xs text-slate-400">
              Chưa có sự kiện trace nào được ghi nhận.
            </div>
          ) : (
            displayed.map((entry) => {
              const isCritical = entry.severity === 'critical';
              return (
                <div
                  key={entry.id}
                  className={`px-3.5 py-2 text-xs leading-snug ${
                    isCritical ? 'bg-rose-950/55 ring-1 ring-inset ring-rose-500/45' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      {isCritical && (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                      <span
                        className={`font-mono-tabular font-semibold ${getActionStyle(
                          entry.tradeAction,
                          entry.category,
                          entry.severity,
                        )}`}
                      >
                        [{getTagLabel(entry)}]
                      </span>
                      <span
                        className={`font-medium truncate ${
                          isCritical ? 'text-rose-100' : 'text-slate-300'
                        }`}
                      >
                        {entry.source}
                      </span>
                    </div>
                    <span className="font-mono-tabular text-slate-500 shrink-0">
                      {entry.timestamp} · T+{entry.tick}
                    </span>
                  </div>
                  <div className={`mt-0.5 ${isCritical ? 'text-rose-100 font-medium' : 'text-slate-200'}`}>
                    {entry.message}
                  </div>
                  {entry.detail && (
                    <div
                      className={`mt-0.5 text-[11px] ${
                        isCritical ? 'text-rose-200/85' : 'text-slate-400'
                      }`}
                    >
                      {entry.detail}
                    </div>
                  )}
                  {isCritical && onTriggerUrgentSwarm && (
                    <div className="mt-1.5 flex justify-end">
                      <button
                        type="button"
                        onClick={onTriggerUrgentSwarm}
                        className="px-2 py-0.5 rounded border border-rose-400/50 bg-rose-500/20 hover:bg-rose-500/35 text-rose-100 text-[10.5px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Bot className="w-3 h-3" />
                        Swarm xử lý gấp
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
};
