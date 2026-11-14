import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  Info,
  Send,
  Terminal,
  Trash2,
} from 'lucide-react';
import { HexLogEntry } from '../types/kettle';
import { bleController } from '../services/bleController';
import { hexToBytes } from '../services/kettleProtocol';
import { useLanguage } from '../i18n/LanguageContext';

interface DevConsoleProps {
  logs: HexLogEntry[];
  onClearLogs: () => void;
}

export const DevConsole: React.FC<DevConsoleProps> = ({ logs, onClearLogs }) => {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<'ALL' | 'TX' | 'RX' | 'SYS'>('ALL');
  const [manualHex, setManualHex] = useState('55 00 06 AA');
  const [hexError, setHexError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  const filteredLogs = logs.filter((log) => (filter === 'ALL' ? true : log.direction === filter));

  const handleCopyLogs = async () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.direction}] ${l.hex} ${l.commandName} ${l.notes || ''}`.trim())
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked
    }
  };

  const handleSendManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const bytes = hexToBytes(manualHex);
    if (!bytes) {
      setHexError(t.console.hexError);
      return;
    }
    setHexError(null);
    await bleController.sendPacketWithReply(bytes);
  };

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span>{t.console.title(logs.length)}</span>
        </h3>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopyLogs()}
            className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? t.console.copied : t.console.copy}</span>
          </button>
          <button
            type="button"
            onClick={onClearLogs}
            className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.console.clear}</span>
          </button>
        </div>
      </div>

      {/* Filter & Manual HEX Send */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 self-start">
          {(['ALL', 'TX', 'RX', 'SYS'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilter(mode)}
              className={`min-h-[36px] px-3 rounded-lg font-mono text-xs font-semibold transition-colors ${
                filter === mode
                  ? 'bg-white dark:bg-cyan-500 text-slate-900 dark:text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => void handleSendManual(e)} className="flex items-center gap-2 flex-1 sm:max-w-sm">
          <input
            type="text"
            value={manualHex}
            onChange={(e) => setManualHex(e.target.value)}
            placeholder="55 00 06 AA"
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-mono text-slate-900 dark:text-cyan-300"
          />
          <button
            type="submit"
            className="min-h-[44px] px-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs font-semibold flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t.console.send}</span>
          </button>
        </form>
      </div>

      {hexError && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{hexError}</p>
      )}

      {/* Log Stream */}
      <div
        ref={scrollRef}
        className="h-60 overflow-y-auto rounded-xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800 font-mono text-xs space-y-1.5"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-600">
            {t.console.empty}
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isTx = log.direction === 'TX';
            const isRx = log.direction === 'RX';
            return (
              <div
                key={log.id}
                className="flex flex-wrap items-baseline gap-2 py-1 border-b border-slate-200/60 dark:border-slate-900"
              >
                <span className="text-slate-400 dark:text-slate-500 text-[10px] tabular-nums select-none">
                  {log.timestamp}
                </span>
                <span
                  className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                    isTx
                      ? 'text-blue-600 dark:text-blue-400'
                      : isRx
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {isTx ? <ArrowUpRight className="w-3 h-3" /> : isRx ? <ArrowDownLeft className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                  {log.direction}
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                  {log.commandName}
                </span>
                {log.hex && (
                  <span className="text-cyan-700 dark:text-cyan-400 break-all select-all">
                    {log.hex}
                  </span>
                )}
                {log.notes && (
                  <span className="text-slate-500 dark:text-slate-400 font-sans text-[11px]">
                    · {log.notes}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
