import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/locales/i18n';
import { del, get, set } from 'idb-keyval';
import JSZip from 'jszip';
import { Archive, CheckCircle2, CircleAlert, Download, FileArchive, Pause, Play, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { TabLayout } from '@/components/TabLayout';

type QueueStatus = 'saving' | 'queued' | 'inspecting' | 'paused' | 'ready' | 'error';

interface ArchiveEntry {
  path: string;
  size: number;
  sha256: string;
  blobKey: string;
}

interface QueueItem {
  id: string;
  name: string;
  size: number;
  type: string;
  blobKey: string;
  status: QueueStatus;
  progress: number;
  entries: ArchiveEntry[];
  error: string;
}

const QUEUE_KEY = 'minecraft-editor-import-export-queue';
const SOURCE_PREFIX = 'minecraft-editor-archive-source:';
const ENTRY_PREFIX = 'minecraft-editor-archive-entry:';
const MAX_ENTRIES = 2000;
const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024;
const MAX_ENTRY_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
const panelClass = 'rounded-lg border border-gray-700 bg-gray-900 p-4 sm:p-5';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(1)} ${unit}`;
}

function safeArchivePath(rawPath: string): string | null {
  if (!rawPath || rawPath.includes('\0')) return null;
  const normalized = rawPath.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) return null;
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '..')) return null;
  const clean = segments.filter((segment) => segment && segment !== '.').join('/');
  if (!clean || clean.startsWith('/')) return null;
  return clean;
}

async function sha256(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('SHA-256 is unavailable in this browser context. Open the app in a secure local context and retry.');
  }
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function storedQueue(): QueueItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is QueueItem =>
      !!item &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.blobKey === 'string' &&
      Array.isArray(item.entries)
    ).map((item) => ({ ...item, status: item.status === 'ready' ? 'ready' : 'queued', progress: 0, error: '' }));
  } catch {
    return [];
  }
}

export const ImportExportTab: React.FC = () => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const paused = useRef(new Set<string>());
  const removed = useRef(new Set<string>());
  const [items, setItems] = useState<QueueItem[]>(storedQueue);
  const [isDragging, setIsDragging] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(items.map(({ status, progress, error, ...item }) => ({
        ...item,
        status: status === 'ready' ? 'ready' : 'queued',
      }))));
    } catch {
      setStorageError('Queue details could not be saved in browser storage.');
    }
  }, [items]);

  const updateItem = (id: string, update: Partial<QueueItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...update } : item));
  };

  const addFiles = async (files: FileList | File[]) => {
    setStorageError('');
    setNotice('');
    const accepted = Array.from(files).filter((file) => /\.(zip|mcpack|mrpack)$/i.test(file.name));
    if (!accepted.length) {
      setNotice('Choose local .zip, .mcpack, or .mrpack archive files.');
      return;
    }
    for (const file of accepted) {
      if (file.size > MAX_ARCHIVE_BYTES) {
        setNotice(`${file.name} is larger than the ${formatBytes(MAX_ARCHIVE_BYTES)} local archive limit.`);
        continue;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const blobKey = `${SOURCE_PREFIX}${id}`;
      const item: QueueItem = {
        id,
        name: file.name,
        size: file.size,
        type: file.name.split('.').pop()?.toUpperCase() ?? 'ZIP',
        blobKey,
        status: 'saving',
        progress: 0,
        entries: [],
        error: '',
      };
      setItems((current) => [...current, item]);
      try {
        await set(blobKey, file);
        updateItem(id, { status: 'queued' });
      } catch {
        updateItem(id, { status: 'error', error: 'Could not save archive to local IndexedDB storage.' });
      }
    }
  };

  const waitWhilePaused = async (id: string) => {
    while (paused.current.has(id)) {
      if (removed.current.has(id)) throw new Error('Archive was removed from the queue.');
      await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
    }
    if (removed.current.has(id)) throw new Error('Archive was removed from the queue.');
  };

  const inspect = async (id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (!item || item.status === 'saving' || item.status === 'inspecting') return;
    removed.current.delete(id);
    paused.current.delete(id);
    updateItem(id, { status: 'inspecting', progress: 0, error: '', entries: [] });
    const extractedKeys: string[] = [];
    try {
      const source = await get<Blob>(item.blobKey);
      if (!source) throw new Error('The original archive is missing from local storage. Remove it and add it again.');
      const zip = await JSZip.loadAsync(source);
      const candidates = Object.values(zip.files).filter((entry) => !entry.dir);
      if (candidates.length > MAX_ENTRIES) throw new Error(`Archive has ${candidates.length} files; the limit is ${MAX_ENTRIES}.`);
      const safeEntries: Array<{ path: string; zipEntry: JSZip.JSZipObject; declaredSize: number | null }> = [];
      const paths = new Set<string>();
      let declaredTotal = 0;
      for (const entry of candidates) {
        const path = safeArchivePath(entry.name);
        if (!path) throw new Error(`Unsafe archive path rejected: ${entry.name.slice(0, 120)}`);
        if (paths.has(path)) throw new Error(`Duplicate normalized archive path rejected: ${path}`);
        paths.add(path);
        const unixMode = typeof entry.unixPermissions === 'number' ? entry.unixPermissions : 0;
        if ((unixMode & 0xf000) === 0xa000) throw new Error(`Symbolic link entry rejected: ${path}`);
        const internal = entry as unknown as { _data?: { uncompressedSize?: number } | null };
        const declaredSize = internal._data?.uncompressedSize;
        if (typeof declaredSize === 'number') {
          if (declaredSize > MAX_ENTRY_BYTES) throw new Error(`Entry exceeds ${formatBytes(MAX_ENTRY_BYTES)}: ${path}`);
          declaredTotal += declaredSize;
          if (declaredTotal > MAX_TOTAL_BYTES) throw new Error(`Archive expands beyond the ${formatBytes(MAX_TOTAL_BYTES)} safety limit.`);
        }
        safeEntries.push({ path, zipEntry: entry, declaredSize: typeof declaredSize === 'number' ? declaredSize : null });
      }

      const entries: ArchiveEntry[] = [];
      let actualTotal = 0;
      for (let index = 0; index < safeEntries.length; index += 1) {
        await waitWhilePaused(id);
        const { path, zipEntry } = safeEntries[index];
        updateItem(id, { progress: safeEntries.length ? Math.round((index / safeEntries.length) * 100) : 90 });
        const blob = await zipEntry.async('blob');
        if (blob.size > MAX_ENTRY_BYTES) throw new Error(`Extracted entry exceeds ${formatBytes(MAX_ENTRY_BYTES)}: ${path}`);
        actualTotal += blob.size;
        if (actualTotal > MAX_TOTAL_BYTES) throw new Error(`Archive expands beyond the ${formatBytes(MAX_TOTAL_BYTES)} safety limit.`);
        const digest = await sha256(blob);
        const blobKey = `${ENTRY_PREFIX}${id}:${index}`;
        await set(blobKey, blob);
        extractedKeys.push(blobKey);
        entries.push({ path, size: blob.size, sha256: digest, blobKey });
      }
      await waitWhilePaused(id);
      updateItem(id, { status: 'ready', progress: 100, entries, error: '' });
      setNotice(`Inspected ${item.name}: ${entries.length} file${entries.length === 1 ? '' : 's'} verified with SHA-256.`);
    } catch (caught) {
      await Promise.all(extractedKeys.map((key) => del(key).catch(() => undefined)));
      const message = caught instanceof Error ? caught.message : 'Archive inspection failed.';
      if (removed.current.has(id)) return;
      if (paused.current.has(id)) {
        updateItem(id, { status: 'paused', error: '' });
        return;
      }
      updateItem(id, { status: 'error', progress: 0, entries: [], error: message });
    }
  };

  const togglePause = (item: QueueItem) => {
    if (item.status === 'inspecting') {
      paused.current.add(item.id);
      updateItem(item.id, { status: 'paused' });
    } else if (item.status === 'paused') {
      paused.current.delete(item.id);
      updateItem(item.id, { status: 'inspecting' });
      void inspect(item.id);
    }
  };

  const removeItem = async (item: QueueItem) => {
    removed.current.add(item.id);
    paused.current.delete(item.id);
    await Promise.all([
      del(item.blobKey).catch(() => undefined),
      ...item.entries.map((entry) => del(entry.blobKey).catch(() => undefined)),
    ]);
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
  };

  const exportOriginal = async (item: QueueItem) => {
    try {
      const blob = await get<Blob>(item.blobKey);
      if (!blob) throw new Error('Original archive not found in local storage.');
      saveBlob(blob, item.name);
      setNotice(`Downloaded the local original archive: ${item.name}`);
      setStorageError('');
    } catch (caught) {
      setStorageError(caught instanceof Error ? caught.message : 'Could not export the original archive.');
    }
  };

  const exportVerifiedPack = async (item: QueueItem) => {
    if (item.status !== 'ready') return;
    setNotice(`Building verified ZIP from ${item.name}…`);
    setStorageError('');
    try {
      const zip = new JSZip();
      for (let index = 0; index < item.entries.length; index += 1) {
        const entry = item.entries[index];
        const safePath = safeArchivePath(entry.path);
        if (!safePath) throw new Error(`Unsafe path found in stored queue entry: ${entry.path}`);
        const blob = await get<Blob>(entry.blobKey);
        if (!blob) throw new Error(`Stored file is missing: ${entry.path}`);
        if (await sha256(blob) !== entry.sha256) throw new Error(`Integrity check failed for ${entry.path}.`);
        zip.file(safePath, blob);
      }
      const output = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, (metadata) => {
        setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, progress: Math.round(metadata.percent) } : candidate));
      });
      const filename = `${item.name.replace(/\.(zip|mcpack|mrpack)$/i, '')}-verified.zip`;
      saveBlob(output, filename);
      setNotice(`Exported ${item.entries.length} verified files as ${filename}.`);
    } catch (caught) {
      setStorageError(caught instanceof Error ? caught.message : 'Could not export the verified archive.');
    }
  };

  const statusLabel: Record<QueueStatus, string> = {
    saving: 'Saving locally…',
    queued: 'Queued',
    inspecting: 'Inspecting',
    paused: 'Paused',
    ready: 'Verified',
    error: 'Error',
  };

  return (
    <TabLayout label={t('tabs.importExport', { defaultValue: 'Import / Export' })} id={7} icon={<Archive />}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <section className="rounded-lg border border-blue-800/70 bg-blue-950/30 p-4 text-sm text-blue-100">
          <p><strong>Offline archive workflow:</strong> files stay in this browser profile's IndexedDB until removed. ZIP, MCPACK, and MRPACK files are inspected locally; MRPACK mod download references are not resolved. SHA-256 is calculated over each extracted file. Archive paths are normalized and traversal paths and symbolic links are rejected.</p>
        </section>

        <section
          className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors sm:p-10 ${isDragging ? 'border-blue-400 bg-blue-950/30' : 'border-gray-700 bg-gray-900'}`}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => { event.preventDefault(); setIsDragging(false); void addFiles(event.dataTransfer.files); }}
        >
          <FileArchive className="mx-auto mb-3 text-blue-400" size={36} />
          <h3 className="text-lg font-semibold text-gray-100">Import local archives</h3>
          <p className="mx-auto mt-1 max-w-xl text-sm text-gray-400">Drop ZIP, MCPACK, or MRPACK files here, or browse your device. Files are stored locally; no network connection is used.</p>
          <input ref={inputRef} type="file" multiple accept=".zip,.mcpack,.mrpack,application/zip" className="hidden" onChange={(event) => {
            if (event.currentTarget.files) void addFiles(event.currentTarget.files);
            event.currentTarget.value = '';
          }} />
          <button onClick={() => inputRef.current?.click()} className="mt-4 inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"><Upload size={16} />Browse archives</button>
          <p className="mt-3 text-xs text-gray-500">Safety limits: {formatBytes(MAX_ARCHIVE_BYTES)} archive, {MAX_ENTRIES.toLocaleString()} files, {formatBytes(MAX_ENTRY_BYTES)} per file, {formatBytes(MAX_TOTAL_BYTES)} expanded archive.</p>
        </section>

        <section className={panelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="text-lg font-semibold text-gray-100">Local queue</h3><p className="text-sm text-gray-400">{items.length} archive{items.length === 1 ? '' : 's'} · source blobs and verified entries persist locally</p></div>
            {items.length > 0 && <button onClick={() => { void Promise.all(items.map(removeItem)); }} className="rounded border border-gray-600 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700">Remove all</button>}
          </div>
          {!items.length ? (
            <div className="rounded border border-dashed border-gray-700 p-8 text-center text-sm text-gray-500">Your import queue is empty.</div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id} className="rounded border border-gray-700 bg-gray-800 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.status === 'ready' ? <CheckCircle2 size={17} className="text-green-400" /> : item.status === 'error' ? <CircleAlert size={17} className="text-red-400" /> : <FileArchive size={17} className="text-blue-400" />}
                        <h4 className="break-all font-medium text-gray-100">{item.name}</h4>
                        <span className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">{item.type}</span>
                        <span className={`text-xs ${item.status === 'error' ? 'text-red-300' : item.status === 'ready' ? 'text-green-300' : 'text-gray-400'}`}>{statusLabel[item.status]}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{formatBytes(item.size)}{item.status === 'ready' ? ` · ${item.entries.length} verified file${item.entries.length === 1 ? '' : 's'}` : ''}</p>
                      {(item.status === 'inspecting' || item.status === 'paused') && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded bg-gray-700"><div className="h-full bg-blue-500 transition-all" style={{ width: `${item.progress}%` }} /></div>
                      )}
                      {item.error && <p role="alert" className="mt-2 break-words text-sm text-red-300">{item.error}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(item.status === 'queued' || item.status === 'error') && <button onClick={() => void inspect(item.id)} className="rounded bg-blue-700 px-3 py-2 text-xs font-medium text-white hover:bg-blue-600">Inspect & verify</button>}
                      {(item.status === 'inspecting' || item.status === 'paused') && <button onClick={() => togglePause(item)} className="inline-flex items-center gap-1 rounded border border-gray-600 px-3 py-2 text-xs text-gray-200 hover:bg-gray-700">{item.status === 'paused' ? <Play size={13} /> : <Pause size={13} />}{item.status === 'paused' ? 'Resume' : 'Pause'}</button>}
                      <button onClick={() => void exportOriginal(item)} disabled={item.status === 'saving'} className="inline-flex items-center gap-1 rounded border border-gray-600 px-3 py-2 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-40"><Download size={13} />Original</button>
                      {item.status === 'ready' && <button onClick={() => void exportVerifiedPack(item)} className="inline-flex items-center gap-1 rounded border border-green-800 px-3 py-2 text-xs text-green-200 hover:bg-green-950"><ShieldCheck size={13} />Export verified ZIP</button>}
                      <button aria-label={`Remove ${item.name}`} onClick={() => void removeItem(item)} className="rounded border border-red-900 px-2 py-2 text-red-300 hover:bg-red-950"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {item.status === 'ready' && item.entries.length > 0 && (
                    <details className="mt-3 border-t border-gray-700 pt-3">
                      <summary className="cursor-pointer text-sm text-gray-300">Show files and SHA-256 checksums ({item.entries.length})</summary>
                      <div className="mt-2 max-h-64 space-y-2 overflow-auto">
                        {item.entries.map((entry) => (
                          <div key={`${item.id}:${entry.path}`} className="rounded bg-gray-900 px-3 py-2">
                            <p className="break-all text-xs text-gray-200">{entry.path} <span className="text-gray-500">· {formatBytes(entry.size)}</span></p>
                            <p className="mt-1 break-all font-mono text-[10px] text-green-300">SHA-256: {entry.sha256}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={`${panelClass} flex items-start gap-3`}>
          <ShieldCheck className="mt-0.5 shrink-0 text-green-400" size={19} />
          <div><h3 className="font-semibold text-gray-100">Integrity and safe export</h3><p className="mt-1 text-sm text-gray-400">Each extracted file is SHA-256 hashed before it is saved. Verified ZIP export re-hashes stored files and only includes safe normalized paths. Exporting the original downloads the untouched local source archive.</p></div>
        </section>
        {(notice || storageError) && <p role={storageError ? 'alert' : 'status'} className={`rounded border p-3 text-sm ${storageError ? 'border-red-800 bg-red-950/50 text-red-300' : 'border-green-800 bg-green-950/40 text-green-200'}`}>{storageError || notice}</p>}
      </div>
    </TabLayout>
  );
};
