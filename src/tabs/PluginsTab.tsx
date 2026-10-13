import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/locales/i18n';
import { Download, FileJson2, PlugZap, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { TabLayout } from '@/components/TabLayout';

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  permissions: string[];
}

interface LocalPlugin {
  manifest: PluginManifest;
  enabled: boolean;
  importedAt: string;
}

interface PluginLog {
  id: string;
  time: string;
  message: string;
}

interface PluginStorage {
  plugins: LocalPlugin[];
  logs: PluginLog[];
}

const STORAGE_KEY = 'minecraft-editor-local-plugins';
const ALLOWED_FIELDS = new Set(['id', 'name', 'version', 'description', 'author', 'permissions']);
const inputClass =
  'w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500';

function parseManifest(value: unknown): PluginManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Manifest must be a JSON object.');
  }
  const raw = value as Record<string, unknown>;
  const unexpected = Object.keys(raw).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unexpected.length) {
    throw new Error(`Unsupported manifest field(s): ${unexpected.join(', ')}. Executable plugin packages are not supported.`);
  }
  const { id, name, version, description, author, permissions } = raw;
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(id.trim())) {
    throw new Error('ID must be 2–64 letters, numbers, dots, underscores, or hyphens.');
  }
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
    throw new Error('Name is required and must be at most 80 characters.');
  }
  if (typeof version !== 'string' || !/^\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?$/.test(version.trim())) {
    throw new Error('Version must look like 1.0 or 1.0.0.');
  }
  if (typeof description !== 'string' || !description.trim() || description.length > 500) {
    throw new Error('Description is required and must be at most 500 characters.');
  }
  if (author !== undefined && (typeof author !== 'string' || author.length > 80)) {
    throw new Error('Author must be plain text of at most 80 characters.');
  }
  if (permissions !== undefined && (!Array.isArray(permissions) || permissions.some((item) => typeof item !== 'string' || item.length > 80))) {
    throw new Error('Permissions must be a list of short text labels.');
  }
  return {
    id: id.trim(),
    name: name.trim(),
    version: version.trim(),
    description: description.trim(),
    author: typeof author === 'string' ? author.trim() : 'Unknown',
    permissions: Array.isArray(permissions) ? permissions.map((item) => (item as string).trim()).filter(Boolean).slice(0, 20) : [],
  };
}

function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const makeLog = (message: string): PluginLog => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  time: new Date().toISOString(),
  message,
});

export const PluginsTab: React.FC = () => {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [plugins, setPlugins] = useState<LocalPlugin[]>([]);
  const [logs, setLogs] = useState<PluginLog[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ id: '', name: '', version: '1.0.0', description: '', author: '' });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<PluginStorage>;
        if (Array.isArray(stored.plugins)) {
          const safePlugins: LocalPlugin[] = [];
          for (const value of stored.plugins) {
            if (!value || typeof value !== 'object') continue;
            const candidate = value as Partial<LocalPlugin>;
            try {
              if (typeof candidate.enabled !== 'boolean' || typeof candidate.importedAt !== 'string') continue;
              safePlugins.push({
                manifest: parseManifest(candidate.manifest),
                enabled: candidate.enabled,
                importedAt: candidate.importedAt,
              });
            } catch {
              continue;
            }
          }
          setPlugins(safePlugins);
        }
        if (Array.isArray(stored.logs)) {
          setLogs(stored.logs.filter((value): value is PluginLog =>
            !!value &&
            typeof value === 'object' &&
            typeof (value as PluginLog).id === 'string' &&
            typeof (value as PluginLog).time === 'string' &&
            typeof (value as PluginLog).message === 'string'
          ).slice(0, 100));
        }
      }
    } catch {
      setError('Could not read the local plugin registry. It will be replaced when you save a change.');
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ plugins, logs: logs.slice(0, 100) }));
      setError('');
    } catch {
      setError('Could not save the plugin registry. Browser storage may be full or unavailable.');
    }
  }, [logs, plugins, ready]);

  const addLog = (message: string) => setLogs((current) => [makeLog(message), ...current].slice(0, 100));

  const addManifest = (manifest: PluginManifest) => {
    if (plugins.some((plugin) => plugin.manifest.id.toLowerCase() === manifest.id.toLowerCase())) {
      throw new Error(`A manifest with ID "${manifest.id}" is already in the local registry.`);
    }
    setPlugins((current) => [...current, { manifest, enabled: false, importedAt: new Date().toISOString() }]);
    addLog(`Added manifest "${manifest.name}" (${manifest.id}); execution is disabled and unsupported.`);
  };

  const createManifest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      addManifest(parseManifest({ ...form, permissions: [] }));
      setForm({ id: '', name: '', version: '1.0.0', description: '', author: '' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add this manifest.');
    }
  };

  const importManifestFile = async (file: File) => {
    setError('');
    try {
      if (file.size > 1024 * 1024) throw new Error('Manifest JSON is too large; the local limit is 1 MB.');
      const parsed: unknown = JSON.parse(await file.text());
      const candidates =
        parsed && typeof parsed === 'object' && 'plugins' in parsed
          ? (parsed as { plugins: unknown }).plugins
          : [parsed];
      if (!Array.isArray(candidates) || candidates.length === 0 || candidates.length > 100) {
        throw new Error('Choose a manifest or a registry JSON containing 1–100 manifests.');
      }
      const manifests = candidates.map(parseManifest);
      const ids = new Set(plugins.map((plugin) => plugin.manifest.id.toLowerCase()));
      for (const manifest of manifests) {
        const id = manifest.id.toLowerCase();
        if (ids.has(id)) throw new Error(`Duplicate manifest ID: ${manifest.id}. No manifests were added.`);
        ids.add(id);
      }
      setPlugins((current) => [
        ...current,
        ...manifests.map((manifest) => ({ manifest, enabled: false, importedAt: new Date().toISOString() })),
      ]);
      addLog(`Imported ${manifests.length} manifest${manifests.length === 1 ? '' : 's'} from ${file.name}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not import this manifest file.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const togglePlugin = (id: string) => {
    const plugin = plugins.find((item) => item.manifest.id === id);
    if (!plugin) return;
    const nextEnabled = !plugin.enabled;
    setPlugins((current) =>
      current.map((item) => (item.manifest.id === id ? { ...item, enabled: nextEnabled } : item))
    );
    addLog(`${nextEnabled ? 'Enabled' : 'Disabled'} local manifest "${plugin.manifest.name}". This does not load or run code.`);
  };

  const removePlugin = (id: string) => {
    const plugin = plugins.find((item) => item.manifest.id === id);
    if (!plugin) return;
    setPlugins((current) => current.filter((item) => item.manifest.id !== id));
    addLog(`Removed manifest "${plugin.manifest.name}" from the local registry.`);
  };

  const exportRegistry = () => {
    downloadJson('minecraft-editor-plugin-manifests.json', {
      format: 'minecraft-texture-editor-plugin-manifests',
      version: 1,
      plugins: plugins.map((plugin) => plugin.manifest),
    });
    addLog('Exported the local plugin manifest registry.');
  };

  const clearLogs = () => setLogs([]);

  return (
    <TabLayout label={t('tabs.plugins', { defaultValue: 'Plugins' })} id={6} icon={<PlugZap />}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <section className="flex gap-3 rounded-lg border border-amber-700/70 bg-amber-950/40 p-4 text-sm text-amber-100">
          <ShieldAlert className="mt-0.5 shrink-0" size={20} />
          <div>
            <h3 className="font-semibold">Safe, local manifest registry only</h3>
            <p className="mt-1 text-amber-200/80">
              This app records plugin metadata and enabled/disabled labels only. It never executes imported files,
              scripts, or plugin code; enabling a manifest is a local organization flag, not an integration.
              Nothing is downloaded from a marketplace or sent to an external service.
            </p>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
          <section className="rounded-lg border border-gray-700 bg-gray-900 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-gray-100">Local manifests</h3>
                <p className="text-sm text-gray-400">{plugins.length} saved on this device</p>
              </div>
              <div className="flex gap-2">
                <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void importManifestFile(file);
                }} />
                <button onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 rounded border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"><Upload size={15} />Import JSON</button>
                <button onClick={exportRegistry} disabled={!plugins.length} className="inline-flex items-center gap-2 rounded border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"><Download size={15} />Export</button>
              </div>
            </div>
            {plugins.length === 0 ? (
              <div className="rounded border border-dashed border-gray-700 p-8 text-center text-sm text-gray-400">
                <FileJson2 className="mx-auto mb-2" size={24} />
                No plugin manifests yet. Add metadata below or import a JSON manifest.
              </div>
            ) : (
              <ul className="space-y-3">
                {plugins.map((plugin) => (
                  <li key={plugin.manifest.id} className="rounded border border-gray-700 bg-gray-800 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-gray-100">{plugin.manifest.name}</h4>
                          <span className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">v{plugin.manifest.version}</span>
                          <span className={`rounded px-2 py-0.5 text-xs ${plugin.enabled ? 'bg-green-900 text-green-200' : 'bg-gray-700 text-gray-300'}`}>
                            {plugin.enabled ? 'Enabled (metadata only)' : 'Disabled'}
                          </span>
                        </div>
                        <p className="mt-1 break-words text-sm text-gray-400">{plugin.manifest.description}</p>
                        <p className="mt-2 text-xs text-gray-500">ID: {plugin.manifest.id} · Author: {plugin.manifest.author} · Added {new Date(plugin.importedAt).toLocaleDateString()}</p>
                        {plugin.manifest.permissions.length > 0 && (
                          <p className="mt-1 text-xs text-amber-300">Declared permissions (informational only): {plugin.manifest.permissions.join(', ')}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => togglePlugin(plugin.manifest.id)} className="rounded bg-blue-700 px-3 py-2 text-xs font-medium text-white hover:bg-blue-600">
                          {plugin.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button aria-label={`Remove ${plugin.manifest.name}`} onClick={() => removePlugin(plugin.manifest.id)} className="rounded border border-red-800 px-2 py-2 text-red-300 hover:bg-red-950"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-gray-700 bg-gray-900 p-4 sm:p-5">
            <h3 className="mb-1 text-lg font-semibold text-gray-100">Add a manifest</h3>
            <p className="mb-4 text-sm text-gray-400">Enter descriptive metadata. No executable payload is accepted.</p>
            <form className="space-y-3" onSubmit={createManifest}>
              <label className="block text-sm text-gray-300">ID<input required maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9._-]{1,63}" className={`${inputClass} mt-1`} value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} placeholder="example-plugin" /></label>
              <label className="block text-sm text-gray-300">Name<input required maxLength={80} className={`${inputClass} mt-1`} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm text-gray-300">Version<input required pattern="\d+\.\d+(\.\d+)?([+-][\w.-]+)?" className={`${inputClass} mt-1`} value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} /></label>
                <label className="block text-sm text-gray-300">Author<input maxLength={80} className={`${inputClass} mt-1`} value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} /></label>
              </div>
              <label className="block text-sm text-gray-300">Description<textarea required maxLength={500} rows={3} className={`${inputClass} mt-1 resize-y`} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <button type="submit" className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Add locally</button>
            </form>
          </section>
        </div>

        <section className="rounded-lg border border-gray-700 bg-gray-900 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h3 className="font-semibold text-gray-100">Local activity log</h3><p className="text-xs text-gray-500">Most recent 100 registry actions; stored only in local browser storage.</p></div>
            <button onClick={clearLogs} disabled={!logs.length} className="rounded border border-gray-600 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-40">Clear log</button>
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {logs.length ? logs.map((log) => (
              <p key={log.id} className="break-words text-sm text-gray-400"><time className="mr-2 text-xs text-gray-500">{new Date(log.time).toLocaleString()}</time>{log.message}</p>
            )) : <p className="text-sm text-gray-500">No activity recorded.</p>}
          </div>
        </section>
        {error && <p role="alert" className="rounded border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}
      </div>
    </TabLayout>
  );
};
