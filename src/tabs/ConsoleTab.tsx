import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Download,
  Info,
  Search,
  Trash2,
  TerminalSquare,
} from 'lucide-react';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface LocalLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: string;
}

const STORAGE_KEY = 'minecraft-editor-local-console-v1';
const MAX_LOGS = 500;
const LOG_EVENT = 'minecraft-editor-local-log';

const isLogLevel = (level: unknown): level is LogLevel =>
  level === 'info' || level === 'success' || level === 'warning' || level === 'error';

export const readConsoleLogs = (): LocalLogEntry[] => {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) throw new Error('Saved console log data has an unexpected format.');
  return parsed.filter(
    (item): item is LocalLogEntry =>
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      typeof item.id === 'string' &&
      'timestamp' in item &&
      typeof item.timestamp === 'string' &&
      'level' in item &&
      isLogLevel(item.level) &&
      'message' in item &&
      typeof item.message === 'string'
  );
};

/** Append a local console entry; safe to call from this feature's future app actions. */
export const appendConsoleLog = (
  level: LogLevel,
  message: string,
  details?: string
): LocalLogEntry | null => {
  if (typeof window === 'undefined') return null;
  const entry: LocalLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(details ? { details } : {}),
  };
  try {
    const entries = readConsoleLogs();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...entries].slice(0, MAX_LOGS)));
    window.dispatchEvent(new CustomEvent(LOG_EVENT));
    return entry;
  } catch {
    return null;
  }
};

const levelStyles: Record<LogLevel, { icon: React.ReactNode; text: string }> = {
  info: { icon: <Info size={15} />, text: 'text-sky-300' },
  success: { icon: <CheckCircle2 size={15} />, text: 'text-emerald-300' },
  warning: { icon: <AlertTriangle size={15} />, text: 'text-amber-300' },
  error: { icon: <Bug size={15} />, text: 'text-red-300' },
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });

export const ConsoleTab: React.FC = () => {
  const [entries, setEntries] = useState<LocalLogEntry[]>([]);
  const [level, setLevel] = useState<'all' | LogLevel>('all');
  const [query, setQuery] = useState('');
  const [storageError, setStorageError] = useState('');

  const refresh = useCallback(() => {
    try {
      setEntries(readConsoleLogs());
      setStorageError('');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Unable to load local logs.');
    }
  }, []);

  useEffect(() => {
    refresh();
    const onLog = () => refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) refresh();
    };
    window.addEventListener(LOG_EVENT, onLog);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(LOG_EVENT, onLog);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesLevel = level === 'all' || entry.level === level;
      const matchesText =
        !needle ||
        `${entry.message} ${entry.details ?? ''}`.toLowerCase().includes(needle);
      return matchesLevel && matchesText;
    });
  }, [entries, level, query]);

  const clearLogs = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      setEntries([]);
      setStorageError('');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Unable to clear local logs.');
    }
  };

  const exportLogs = () => {
    const contents = JSON.stringify(entries, null, 2);
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `texture-editor-logs-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const addSampleLog = (sampleLevel: LogLevel, message: string) => {
    if (!appendConsoleLog(sampleLevel, message)) {
      setStorageError('Could not save the log. Check that local storage is available.');
    }
  };

  const countFor = (selected: LogLevel) =>
    entries.filter((entry) => entry.level === selected).length;

  return (
    <div className="h-full overflow-y-auto bg-gray-900 p-4 text-gray-100 sm:p-6">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">Device-local diagnostics</p>
            <h1 className="text-2xl font-bold">Console</h1>
            <p className="mt-1 text-sm text-gray-400">Inspect and export this app’s local action log. No data is sent anywhere.</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-400">
            {entries.length} / {MAX_LOGS} retained entries
          </div>
        </header>

        {storageError && (
          <div role="alert" className="rounded-lg border border-red-700 bg-red-950/60 p-3 text-sm text-red-200">
            Local storage issue: {storageError}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(['info', 'success', 'warning', 'error'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() =>
                addSampleLog(
                  item,
                  item === 'info'
                    ? 'Local console opened'
                    : `Example ${item} entry added from the console`
                )
              }
              className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/70 p-3 text-left hover:border-gray-500"
            >
              <span className={levelStyles[item].text}>{levelStyles[item].icon}</span>
              <span className="min-w-0 flex-1 text-sm capitalize text-gray-200">{item}</span>
              <span className="text-sm font-semibold text-gray-400">{countFor(item)}</span>
            </button>
          ))}
        </div>

        <section className="flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-950">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 p-3">
            <div className="relative min-w-[180px] flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search messages and details"
                aria-label="Search console logs"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value as 'all' | LogLevel)}
              aria-label="Filter log level"
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200"
            >
              <option value="all">All levels</option>
              {(['info', 'success', 'warning', 'error'] as const).map((item) => (
                <option key={item} value={item}>{item[0].toUpperCase()}{item.slice(1)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={exportLogs}
              disabled={!entries.length}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-40"
            >
              <Download size={16} /> Export
            </button>
            <button
              type="button"
              onClick={clearLogs}
              disabled={!entries.length}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300 hover:bg-red-950 disabled:opacity-40"
            >
              <Trash2 size={16} /> Clear
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/70 px-4 py-2 text-xs text-gray-500">
            <span className="flex items-center gap-2"><TerminalSquare size={14} /> Local app log</span>
            <span>{filteredEntries.length} shown</span>
          </div>
          <div className="flex-1 overflow-auto">
            {filteredEntries.length === 0 ? (
              <div className="flex min-h-60 flex-col items-center justify-center px-5 text-center">
                <TerminalSquare size={32} className="mb-3 text-gray-600" />
                <p className="text-sm font-medium text-gray-300">
                  {entries.length ? 'No entries match these filters' : 'No local log entries yet'}
                </p>
                <p className="mt-1 max-w-md text-xs text-gray-500">
                  Log entries from this tab are kept in this browser profile. Use a level tile above to add a sample entry.
                </p>
              </div>
            ) : (
              <ol className="divide-y divide-gray-800 font-mono text-xs">
                {filteredEntries.map((entry) => (
                  <li key={entry.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[150px_75px_minmax(0,1fr)]">
                    <time dateTime={entry.timestamp} className="text-gray-500">{formatDate(entry.timestamp)}</time>
                    <span className={`flex items-center gap-1.5 uppercase ${levelStyles[entry.level].text}`}>
                      {levelStyles[entry.level].icon} {entry.level}
                    </span>
                    <div className="min-w-0 break-words text-gray-200">
                      {entry.message}
                      {entry.details && <pre className="mt-1 whitespace-pre-wrap text-gray-500">{entry.details}</pre>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
        <p className="text-xs text-gray-500">Newest entries appear first. Logs are limited to {MAX_LOGS} items and remain on this device until cleared.</p>
      </div>
    </div>
  );
};
