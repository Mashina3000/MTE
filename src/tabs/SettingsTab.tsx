import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/locales/i18n';
import { Check, Download, RotateCcw, Save, Settings2 } from 'lucide-react';
import { TabLayout } from '@/components/TabLayout';
import { useStore } from '@/store';

type Theme = 'dark' | 'light' | 'auto';
type Language = 'en' | 'ru';

interface Preferences {
  theme: Theme;
  language: Language;
  uiSize: number;
  autosave: boolean;
  autosaveMinutes: number;
  shortcutsEnabled: boolean;
  gridShortcut: string;
}

interface Snapshot {
  createdAt: string;
  data: {
    packName: string;
    packFormat: number;
    selectedVersions: string[];
    currentTool: string;
    brushSize: number;
    gridVisible: boolean;
  };
}

const STORAGE_KEY = 'minecraft-editor-settings';
const SNAPSHOT_KEY = 'minecraft-editor-autosave-snapshot';
const DEFAULTS: Preferences = {
  theme: 'dark',
  language: 'ru',
  uiSize: 15,
  autosave: true,
  autosaveMinutes: 2,
  shortcutsEnabled: true,
  gridShortcut: 'g',
};

const isTheme = (value: unknown): value is Theme =>
  value === 'dark' || value === 'light' || value === 'auto';

function readPreferences(): Preferences {
  try {
    if (typeof window === 'undefined') return DEFAULTS;
    const existingLanguage = localStorage.getItem('language') === 'en' ? 'en' : 'ru';
    const initial = { ...DEFAULTS, language: existingLanguage };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    const saved = JSON.parse(raw) as Partial<Preferences>;
    return {
      ...initial,
      ...saved,
      theme: isTheme(saved.theme) ? saved.theme : DEFAULTS.theme,
      language: saved.language === 'ru' || saved.language === 'en' ? saved.language : initial.language,
      uiSize: typeof saved.uiSize === 'number' ? Math.max(13, Math.min(18, saved.uiSize)) : DEFAULTS.uiSize,
      autosaveMinutes: [1, 2, 5, 10].includes(saved.autosaveMinutes ?? -1)
        ? saved.autosaveMinutes!
        : DEFAULTS.autosaveMinutes,
      gridShortcut:
        typeof saved.gridShortcut === 'string' && saved.gridShortcut.length === 1
          ? saved.gridShortcut.toLowerCase()
          : DEFAULTS.gridShortcut,
    };
  } catch {
    return DEFAULTS;
  }
}

export const applySavedSettingsAppearance = () => {
  if (typeof document === 'undefined') return;
  const preferences = readPreferences();
  const root = document.documentElement;
  const body = document.body;
  root.dataset.appTheme = preferences.theme;
  root.style.fontSize = `${preferences.uiSize}px`;
  if (body) {
    body.dataset.appTheme = preferences.theme;
    body.style.fontSize = `${preferences.uiSize}px`;
  }

  let style = document.getElementById('minecraft-editor-settings-theme') as HTMLStyleElement | null;
  if (!style && document.head) {
    style = document.createElement('style');
    style.id = 'minecraft-editor-settings-theme';
    document.head.appendChild(style);
  }
  if (!style) return;

  style.textContent = `
    [data-app-theme="light"] body { background: #f3f4f6; color: #111827; }
    [data-app-theme="light"] .bg-gray-900 { background-color: #e5e7eb !important; }
    [data-app-theme="light"] .bg-gray-800 { background-color: #f9fafb !important; }
    [data-app-theme="light"] .bg-gray-700 { background-color: #d1d5db !important; }
    [data-app-theme="light"] .text-white { color: #111827 !important; }
    [data-app-theme="light"] .text-gray-100,
    [data-app-theme="light"] .text-gray-200,
    [data-app-theme="light"] .text-gray-300 { color: #1f2937 !important; }
    [data-app-theme="light"] .text-gray-400,
    [data-app-theme="light"] .text-gray-500 { color: #4b5563 !important; }
    [data-app-theme="light"] .border-gray-700,
    [data-app-theme="light"] .border-gray-600 { border-color: #cbd5e1 !important; }
    [data-app-theme="light"] input,
    [data-app-theme="light"] textarea,
    [data-app-theme="light"] select { color: #111827; }
    @media (prefers-color-scheme: light) {
      [data-app-theme="auto"] body { background: #f3f4f6; color: #111827; }
      [data-app-theme="auto"] .bg-gray-900 { background-color: #e5e7eb !important; }
      [data-app-theme="auto"] .bg-gray-800 { background-color: #f9fafb !important; }
      [data-app-theme="auto"] .bg-gray-700 { background-color: #d1d5db !important; }
      [data-app-theme="auto"] .text-white { color: #111827 !important; }
      [data-app-theme="auto"] .text-gray-100,
      [data-app-theme="auto"] .text-gray-200,
      [data-app-theme="auto"] .text-gray-300 { color: #1f2937 !important; }
      [data-app-theme="auto"] .text-gray-400,
      [data-app-theme="auto"] .text-gray-500 { color: #4b5563 !important; }
      [data-app-theme="auto"] .border-gray-700,
      [data-app-theme="auto"] .border-gray-600 { border-color: #cbd5e1 !important; }
      [data-app-theme="auto"] input,
      [data-app-theme="auto"] textarea,
      [data-app-theme="auto"] select { color: #111827; }
    }
  `;
};

const fieldClass =
  'w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500';
const labelClass = 'mb-1 block text-sm font-medium text-gray-300';

export const SettingsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [snapshotMessage, setSnapshotMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      setSaveError('');
    } catch {
      setSaveError('Could not save preferences in this browser profile.');
    }

    applySavedSettingsAppearance();

    void i18n.changeLanguage(preferences.language);
    try {
      if (typeof window !== 'undefined') localStorage.setItem('language', preferences.language);
    } catch {
      setSaveError('Could not save language preference in this browser profile.');
    }
    const store = useStore.getState();
    store.setTheme(preferences.theme);
    store.setLanguage(preferences.language);
  }, [i18n, preferences]);

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const writeSnapshot = () => {
    try {
      const store = useStore.getState();
      const snapshot: Snapshot = {
        createdAt: new Date().toISOString(),
        data: {
          packName: store.packName,
          packFormat: store.packFormat,
          selectedVersions: store.selectedVersions,
          currentTool: store.currentTool,
          brushSize: store.brushSize,
          gridVisible: store.gridVisible,
        },
      };
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
      setLastSaved(snapshot.createdAt);
      setSnapshotMessage('Local editor snapshot saved.');
    } catch {
      setSnapshotMessage('Could not write the local snapshot. Check browser storage availability.');
    }
  };

  useEffect(() => {
    if (!preferences.autosave) return undefined;
    const timer = window.setInterval(writeSnapshot, preferences.autosaveMinutes * 60_000);
    return () => window.clearInterval(timer);
  }, [preferences.autosave, preferences.autosaveMinutes]);

  useEffect(() => {
    if (!preferences.shortcutsEnabled) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)))
      ) {
        return;
      }
      if (event.key.toLowerCase() === preferences.gridShortcut) {
        event.preventDefault();
        useStore.getState().toggleGridVisible();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [preferences.gridShortcut, preferences.shortcutsEnabled]);

  const restoreSnapshot = () => {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) {
        setSnapshotMessage('No local snapshot exists yet.');
        return;
      }
      const snapshot = JSON.parse(raw) as Snapshot;
      if (!snapshot.data || !Array.isArray(snapshot.data.selectedVersions)) {
        throw new Error('Invalid snapshot format.');
      }
      useStore.setState(snapshot.data);
      setSnapshotMessage(`Restored the local snapshot from ${new Date(snapshot.createdAt).toLocaleString()}.`);
    } catch {
      setSnapshotMessage('The saved snapshot could not be read.');
    }
  };

  const exportSnapshot = () => {
    const snapshot = localStorage.getItem(SNAPSHOT_KEY);
    if (!snapshot) {
      setSnapshotMessage('Save a local snapshot before exporting it.');
      return;
    }
    const url = URL.createObjectURL(new Blob([snapshot], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'minecraft-editor-backup.json';
    link.click();
    URL.revokeObjectURL(url);
    setSnapshotMessage('Backup downloaded to your device.');
  };

  const usePreset = (preset: 'privacy' | 'performance') => {
    setPreferences((current) =>
      preset === 'privacy'
        ? { ...current, theme: 'dark', language: 'en', uiSize: 14, autosave: false, shortcutsEnabled: false }
        : { ...current, theme: 'dark', uiSize: 14, autosave: true, autosaveMinutes: 5, shortcutsEnabled: true }
    );
  };

  return (
    <TabLayout label={t('tabs.settings', { defaultValue: 'Settings' })} id={5} icon={<Settings2 />}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <section className="rounded-lg border border-gray-700 bg-gray-900 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-100">Appearance & language</h3>
              <p className="text-sm text-gray-400">Changes apply to this local app and are saved on this device.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => usePreset('privacy')} className="rounded border border-gray-600 px-3 py-2 text-xs text-gray-200 hover:bg-gray-700">
                Privacy preset
              </button>
              <button onClick={() => usePreset('performance')} className="rounded border border-gray-600 px-3 py-2 text-xs text-gray-200 hover:bg-gray-700">
                Performance preset
              </button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label>
              <span className={labelClass}>Theme</span>
              <select className={fieldClass} value={preferences.theme} onChange={(event) => update('theme', event.target.value as Theme)}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="auto">Follow system</option>
              </select>
            </label>
            <label>
              <span className={labelClass}>Language</span>
              <select className={fieldClass} value={preferences.language} onChange={(event) => update('language', event.target.value as Language)}>
                <option value="en">English</option>
                <option value="ru">Русский</option>
              </select>
            </label>
            <label>
              <span className={labelClass}>Interface size: {preferences.uiSize}px</span>
              <input className="w-full accent-blue-500" type="range" min={13} max={18} step={1} value={preferences.uiSize} onChange={(event) => update('uiSize', Number(event.target.value))} />
              <span className="text-xs text-gray-500">Adjusts the app's root text scale.</span>
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-gray-700 bg-gray-900 p-4 sm:p-6">
          <h3 className="mb-1 text-lg font-semibold text-gray-100">Local backups & keyboard</h3>
          <p className="mb-4 text-sm text-gray-400">Autosave creates a recoverable editor-state snapshot in this browser profile. No files leave your device.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded border border-gray-700 bg-gray-800 p-4">
              <label className="flex items-center gap-3 text-sm text-gray-200">
                <input type="checkbox" checked={preferences.autosave} onChange={(event) => update('autosave', event.target.checked)} />
                Periodic local snapshot
              </label>
              <label className="mt-3 block">
                <span className={labelClass}>Snapshot interval</span>
                <select className={fieldClass} disabled={!preferences.autosave} value={preferences.autosaveMinutes} onChange={(event) => update('autosaveMinutes', Number(event.target.value))}>
                  <option value={1}>Every minute</option>
                  <option value={2}>Every 2 minutes</option>
                  <option value={5}>Every 5 minutes</option>
                  <option value={10}>Every 10 minutes</option>
                </select>
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={writeSnapshot} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"><Save size={15} />Save snapshot</button>
                <button onClick={restoreSnapshot} className="inline-flex items-center gap-2 rounded border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"><RotateCcw size={15} />Restore</button>
                <button onClick={exportSnapshot} className="inline-flex items-center gap-2 rounded border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"><Download size={15} />Download backup</button>
              </div>
              {lastSaved && <p className="mt-2 text-xs text-gray-500">Last saved: {new Date(lastSaved).toLocaleString()}</p>}
            </div>
            <div className="rounded border border-gray-700 bg-gray-800 p-4">
              <label className="flex items-center gap-3 text-sm text-gray-200">
                <input type="checkbox" checked={preferences.shortcutsEnabled} onChange={(event) => update('shortcutsEnabled', event.target.checked)} />
                Enable local keyboard shortcuts
              </label>
              <label className="mt-3 block">
                <span className={labelClass}>Toggle editor grid</span>
                <select className={fieldClass} value={preferences.gridShortcut} onChange={(event) => update('gridShortcut', event.target.value)}>
                  {['g', 'h', 'j', 'k'].map((key) => <option key={key} value={key}>{key.toUpperCase()}</option>)}
                </select>
              </label>
              <p className="mt-2 text-xs text-gray-500">Press the selected key outside text fields to toggle the editor grid.</p>
            </div>
          </div>
          {(snapshotMessage || saveError) && (
            <p role="status" className={`mt-3 flex items-center gap-2 text-sm ${saveError ? 'text-red-400' : 'text-green-400'}`}>
              {!saveError && <Check size={15} />}{saveError || snapshotMessage}
            </p>
          )}
        </section>
      </div>
    </TabLayout>
  );
};
