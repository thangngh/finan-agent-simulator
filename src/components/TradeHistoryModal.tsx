import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, FileSpreadsheet, Search, X } from 'lucide-react';
import { formatUsd } from '../simulation/financialEngine';
import { DecisionCategoryTag, DecisionLogEntry } from '../types/finance';

interface TradeHistoryModalProps {
  open: boolean;
  entries: DecisionLogEntry[];
  currentTick: number;
  currentCapitalUsd: number;
  currentNav: number;
  onClose: () => void;
}

type HistoryFilter = 'ALL' | 'MUA' | 'GIỮ' | 'BÁN' | 'SYSTEM';

function inferTag(entry: DecisionLogEntry): DecisionCategoryTag {
  if (entry.tradeType) return entry.tradeType;
  const upper = entry.action.toUpperCase();
  if (upper.includes('PHÁI SINH') || upper.includes('OPTION') || upper.includes('FUTURES') || upper.includes('HEDGE')) {
    return 'HEDGE';
  }
  if (upper.startsWith('MUA')) return 'MUA';
  if (upper.startsWith('BÁN')) return 'BÁN';
  if (upper.startsWith('GIỮ')) return 'GIỮ';
  if (upper.includes('SWARM')) return 'SWARM';
  if (upper.startsWith('KỊCH BẢN')) return 'SCENARIO';
  return 'INIT';
}

function getTagColorClass(tag: DecisionCategoryTag): string {
  switch (tag) {
    case 'MUA':
      return 'text-emerald-400';
    case 'BÁN':
      return 'text-rose-400';
    case 'GIỮ':
      return 'text-amber-300';
    case 'HEDGE':
      return 'text-cyan-300';
    case 'SWARM':
      return 'text-sky-300';
    case 'SCENARIO':
      return 'text-indigo-300';
    default:
      return 'text-slate-300';
  }
}

function escapeCsvCell(raw: string | number | undefined): string {
  const str = raw === undefined ? '' : String(raw);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildSimulatedCsv(rows: DecisionLogEntry[]): string {
  const headers = [
    'STT',
    'Thoi_Gian',
    'Tick',
    'Loai_Lenh',
    'Tai_San_Pham_Vi',
    'Quyet_Dinh',
    'Von_Hoa_USD',
    'NAV',
    'Ky_Vong_Nam_Pct',
    'Chi_Tiet',
  ];

  const lines = [headers.join(',')];
  rows.forEach((entry, index) => {
    const tag = inferTag(entry);
    lines.push(
      [
        index + 1,
        entry.timestamp ?? '--:--:--',
        `T+${entry.tick}`,
        tag,
        entry.assetLabel ?? 'Danh mục tổng hợp',
        entry.action,
        entry.capitalUsd ?? '',
        entry.nav !== undefined ? entry.nav.toFixed(2) : '',
        entry.deltaReturnPct.toFixed(2),
        entry.detail,
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  });

  return lines.join('\r\n');
}

export const TradeHistoryModal: React.FC<TradeHistoryModalProps> = ({
  open,
  entries,
  currentTick,
  currentCapitalUsd,
  currentNav,
  onClose,
}) => {
  const [filter, setFilter] = useState<HistoryFilter>('ALL');
  const [query, setQuery] = useState('');
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const counts = useMemo(() => {
    let buy = 0;
    let hold = 0;
    let sell = 0;
    let sys = 0;
    for (const e of entries) {
      const t = inferTag(e);
      if (t === 'MUA') buy++;
      else if (t === 'GIỮ') hold++;
      else if (t === 'BÁN') sell++;
      else sys++;
    }
    return { total: entries.length, buy, hold, sell, sys };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const tag = inferTag(entry);
      if (filter === 'MUA' && tag !== 'MUA') return false;
      if (filter === 'GIỮ' && tag !== 'GIỮ') return false;
      if (filter === 'BÁN' && tag !== 'BÁN') return false;
      if (filter === 'SYSTEM' && (tag === 'MUA' || tag === 'GIỮ' || tag === 'BÁN')) {
        return false;
      }
      if (!q) return true;
      return (
        entry.action.toLowerCase().includes(q) ||
        entry.detail.toLowerCase().includes(q) ||
        (entry.assetLabel ?? '').toLowerCase().includes(q) ||
        tag.toLowerCase().includes(q)
      );
    });
  }, [entries, filter, query]);

  const csvContent = useMemo(() => buildSimulatedCsv(filteredEntries), [filteredEntries]);

  if (!open) return null;

  const handleDownloadCsv = () => {
    const filename = `finworld-trade-history-T${currentTick}.csv`;
    // Prepend UTF-8 BOM so Excel/Sheets renders Vietnamese accents cleanly
    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportStatus(`Đã xuất ${filteredEntries.length} dòng ra ${filename}`);
    window.setTimeout(() => setExportStatus(null), 4000);
  };

  const handleCopyCsv = async () => {
    try {
      await navigator.clipboard.writeText(csvContent);
      setCopied(true);
      setExportStatus(`Đã sao chép ${filteredEntries.length} dòng CSV vào clipboard`);
      window.setTimeout(() => {
        setCopied(false);
        setExportStatus(null);
      }, 3000);
    } catch {
      setShowCsvPreview(true);
      setExportStatus('Đã mở bản xem trước CSV để sao chép thủ công');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lịch sử quyết định và giao dịch"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#05080F]/78 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[84vh] rounded-xl border border-white/14 bg-[#0D1420] shadow-2xl flex flex-col overflow-hidden text-sm">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-mono-tabular">SỔ LỆNH & QUYẾT ĐỊNH</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">{entries.length} bản ghi</span>
              <span aria-hidden="true">·</span>
              <span>
                Vốn hóa hiện tại{' '}
                <strong className="font-mono-tabular text-slate-200">
                  {formatUsd(currentCapitalUsd)}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                NAV <strong className="font-mono-tabular text-slate-200">{currentNav.toFixed(1)}</strong>
              </span>
            </div>
            <h2 className="mt-1 text-base font-semibold text-white">
              Lịch Sử Quyết Định & Giao Dịch Thực Thi
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng lịch sử giao dịch"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar: Filter Tabs, Search & CSV Export Actions */}
        <div className="px-5 py-3 border-b border-white/8 bg-[#0A101A] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="Lọc loại quyết định"
              className="flex items-center gap-1 p-1 rounded-lg bg-[#070B12] border border-white/8"
            >
              {(
                [
                  { id: 'ALL', label: `Tất cả (${counts.total})` },
                  { id: 'MUA', label: `MUA (${counts.buy})` },
                  { id: 'GIỮ', label: `GIỮ (${counts.hold})` },
                  { id: 'BÁN', label: `BÁN (${counts.sell})` },
                  { id: 'SYSTEM', label: `Vĩ mô & Swarm (${counts.sys})` },
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
                    className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-[#1A2538] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm tài sản, lệnh, chi tiết..."
                className="w-52 pl-8 pr-3 py-1.5 rounded-lg border border-white/10 bg-[#070B12] text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCsvPreview((p) => !p)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                showCsvPreview
                  ? 'bg-sky-500/20 border-sky-400/45 text-sky-200'
                  : 'bg-[#141D2D] hover:bg-[#1B273C] border-white/10 text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {showCsvPreview ? 'Xem bảng' : 'Xem trước CSV'}
            </button>

            <button
              type="button"
              onClick={handleCopyCsv}
              disabled={filteredEntries.length === 0}
              className="px-3 py-1.5 rounded-lg bg-[#141D2D] hover:bg-[#1B273C] disabled:opacity-45 border border-white/10 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              Sao chép CSV
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={filteredEntries.length === 0}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Xuất CSV
            </button>
          </div>
        </div>

        {/* Inline Export Notification */}
        {exportStatus && (
          <div className="px-5 py-2 border-b border-emerald-500/25 bg-emerald-500/10 text-xs text-emerald-300 font-medium">
            {exportStatus}
          </div>
        )}

        {/* Main Body: Scrollable Table or Simulated CSV Preview */}
        {showCsvPreview ? (
          <div className="flex-1 overflow-auto custom-scroll p-5 bg-[#080C14]">
            <div className="text-xs text-slate-400 mb-2">
              Định dạng CSV giả lập (RFC-4180 · UTF-8 · {filteredEntries.length} dòng dữ liệu)
            </div>
            <pre className="p-4 rounded-lg border border-white/10 bg-[#0B111A] font-mono-tabular text-[11px] leading-relaxed text-slate-200 overflow-x-auto whitespace-pre">
              {csvContent}
            </pre>
          </div>
        ) : (
          <div className="flex-1 overflow-auto custom-scroll">
            {filteredEntries.length === 0 ? (
              <div className="px-6 py-12 text-center space-y-2">
                <div className="text-sm text-slate-300">
                  Không có giao dịch hoặc quyết định nào khớp bộ lọc hiện tại.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFilter('ALL');
                    setQuery('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#162032] hover:bg-[#1E2B42] border border-white/10 text-xs text-slate-200 transition-colors"
                >
                  Đặt lại bộ lọc
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-[#111927] border-b border-white/10 text-[11px] text-slate-400">
                  <tr>
                    <th className="py-2.5 px-4 font-medium whitespace-nowrap">Thời gian · Tick</th>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap">Loại</th>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap">
                      Quyết định & Tài sản
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                      Vốn hóa · NAV
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                      Kỳ vọng/năm
                    </th>
                    <th className="py-2.5 px-4 font-medium">Chi tiết thực thi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {filteredEntries.map((entry) => {
                    const tag = inferTag(entry);
                    return (
                      <tr key={entry.id} className="hover:bg-white/[0.03] transition-colors align-top">
                        <td className="py-2.5 px-4 font-mono-tabular whitespace-nowrap text-slate-300">
                          <div>{entry.timestamp ?? '--:--:--'}</div>
                          <div className="text-[11px] text-slate-500">T+{entry.tick}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular font-semibold whitespace-nowrap">
                          <span className={getTagColorClass(tag)}>{tag}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-100">{entry.action}</div>
                          {entry.assetLabel && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {entry.assetLabel}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular whitespace-nowrap">
                          <div className="text-slate-100">
                            {entry.capitalUsd !== undefined ? formatUsd(entry.capitalUsd) : '—'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {entry.nav !== undefined ? `NAV ${entry.nav.toFixed(1)}` : ''}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular whitespace-nowrap">
                          <span
                            className={
                              entry.deltaReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }
                          >
                            {entry.deltaReturnPct >= 0 ? '+' : ''}
                            {entry.deltaReturnPct.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-300 leading-relaxed max-w-xs">
                          {entry.detail}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-[#0A101A] flex items-center justify-between gap-3 text-xs text-slate-400">
          <div className="font-mono-tabular">
            MUA {counts.buy} · GIỮ {counts.hold} · BÁN {counts.sell} · Hệ thống {counts.sys}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[#162032] hover:bg-[#1E2B42] border border-white/10 text-slate-200 font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
