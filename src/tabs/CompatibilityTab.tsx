import React, { useMemo, useState } from 'react';
import { Download, FileCheck2, FolderOpen, ShieldAlert } from 'lucide-react';
import { TabLayout } from '@/components/TabLayout';

type Finding = { level: 'ошибка' | 'предупреждение' | 'информация'; text: string };

const DEFAULT_MAPPING = {
  '1.20.1': 15,
  '1.20.2': 18,
  '1.20.4': 22,
  '1.20.5': 32,
  '1.21': 34,
  '1.21.4': 46,
};

export const CompatibilityTab: React.FC = () => {
  const [mappingText, setMappingText] = useState(JSON.stringify(DEFAULT_MAPPING, null, 2));
  const [targetVersion, setTargetVersion] = useState('1.21');
  const [packMetaText, setPackMetaText] = useState('{\n  "pack": {\n    "pack_format": 34,\n    "description": "Мой ресурс-пак"\n  }\n}');
  const [pathsText, setPathsText] = useState('pack.mcmeta\nassets/minecraft/textures/block/example.png');
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [status, setStatus] = useState('');

  const versionMapping = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(mappingText);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
      const entries = Object.entries(parsed);
      if (!entries.length || entries.some(([, value]) => !Number.isInteger(value) || Number(value) < 1)) return null;
      return parsed as Record<string, number>;
    } catch {
      return null;
    }
  }, [mappingText]);

  const loadFolder = async (files: FileList | null) => {
    if (!files?.length) return;
    const names: string[] = [];
    let metadata: string | null = null;
    try {
      for (const file of Array.from(files)) {
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const normalized = relativePath.replace(/\\/g, '/').split('/').filter(Boolean).slice(1).join('/');
        const path = normalized || file.name;
        names.push(path);
        if (path.toLowerCase() === 'pack.mcmeta') metadata = await file.text();
      }
      setPathsText(names.join('\n'));
      if (metadata !== null) setPackMetaText(metadata);
      setStatus(`Загружено файлов для локальной проверки: ${names.length}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось прочитать выбранную папку.');
    }
  };

  const validatePack = () => {
    const result: Finding[] = [];
    const files = pathsText.split(/\r?\n/).map((path) => path.trim().replace(/\\/g, '/')).filter(Boolean);
    const lowerPaths = files.map((path) => path.toLowerCase());
    if (!files.length) result.push({ level: 'ошибка', text: 'Список файлов пуст. Выберите папку или укажите пути вручную.' });
    if (!lowerPaths.includes('pack.mcmeta')) result.push({ level: 'ошибка', text: 'Не найден обязательный файл pack.mcmeta в корне пакета.' });
    if (!lowerPaths.some((path) => path.startsWith('assets/'))) {
      result.push({ level: 'ошибка', text: 'Не найдена папка assets/ с содержимым ресурс-пака.' });
    } else if (!lowerPaths.some((path) => /^assets\/[^/]+\/.+/.test(path))) {
      result.push({ level: 'предупреждение', text: 'В assets/ не найдено файлов внутри пространства имён.' });
    }
    if (!lowerPaths.includes('pack.png')) result.push({ level: 'информация', text: 'Необязательный pack.png отсутствует — можно добавить иконку пакета.' });

    let metadata: { pack?: { pack_format?: unknown; description?: unknown } };
    try {
      metadata = JSON.parse(packMetaText) as { pack?: { pack_format?: unknown; description?: unknown } };
    } catch {
      metadata = {};
      result.push({ level: 'ошибка', text: 'pack.mcmeta содержит некорректный JSON.' });
    }
    if (metadata.pack && typeof metadata.pack === 'object') {
      const format = metadata.pack.pack_format;
      if (!Number.isInteger(format) || Number(format) < 1) {
        result.push({ level: 'ошибка', text: 'Поле pack.pack_format должно быть положительным целым числом.' });
      } else {
        result.push({ level: 'информация', text: `Обнаружен pack_format: ${format}.` });
        if (versionMapping) {
          const expected = versionMapping[targetVersion];
          if (expected === undefined) {
            result.push({ level: 'предупреждение', text: `Для ${targetVersion} нет значения в вашей таблице версий.` });
          } else if (expected !== format) {
            result.push({ level: 'предупреждение', text: `Для ${targetVersion} в вашей таблице указан формат ${expected}, а в pack.mcmeta — ${format}.` });
          } else {
            result.push({ level: 'информация', text: `Формат совпадает с пользовательской таблицей для ${targetVersion}.` });
          }
        }
      }
      if (typeof metadata.pack.description !== 'string' && typeof metadata.pack.description !== 'object') {
        result.push({ level: 'предупреждение', text: 'Добавьте текстовое поле pack.description.' });
      }
    } else if (!result.some((item) => item.text.includes('некорректный JSON'))) {
      result.push({ level: 'ошибка', text: 'В pack.mcmeta отсутствует объект pack.' });
    }
    if (!versionMapping) result.push({ level: 'предупреждение', text: 'Таблица версий некорректна. Ожидается JSON вида {"1.21": 34}.' });
    setFindings(result);
    setStatus(`Проверка завершена: ${result.filter((item) => item.level === 'ошибка').length} ошибок, ${result.filter((item) => item.level === 'предупреждение').length} предупреждений.`);
  };

  const downloadReport = () => {
    if (!findings) return;
    const report = {
      generatedAt: new Date().toISOString(),
      targetVersion,
      versionMapping: versionMapping ?? 'Некорректный JSON',
      files: pathsText.split(/\r?\n/).map((path) => path.trim()).filter(Boolean),
      findings,
    };
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'resource-pack-compatibility-report.json';
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus('Отчёт JSON скачан локально.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось скачать отчёт.');
    }
  };

  return (
    <TabLayout id={9} label="Совместимость" icon={<FileCheck2 className="h-5 w-5" />}>
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-xl border border-gray-700 bg-gray-900 p-5">
          <h3 className="text-xl font-semibold text-white">Локальная проверка ресурс-пака</h3>
          <p className="mt-2 text-sm text-gray-400">
            Проверяются выбранные файлы, структура и pack.mcmeta. Таблица соответствия версий редактируется вами; проверки модов и шейдеров не выполняются.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl border border-gray-700 bg-gray-900 p-5">
            <h4 className="font-semibold text-white">Файлы пакета</h4>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-gray-600 p-4 text-sm text-gray-300 hover:bg-gray-800">
              <FolderOpen className="h-5 w-5" /> Выбрать папку ресурс-пака
              <input
                type="file"
                multiple
                className="sr-only"
                ref={(element) => { if (element) element.setAttribute('webkitdirectory', ''); }}
                onChange={(event) => { void loadFolder(event.target.files); }}
              />
            </label>
            <label className="block text-sm text-gray-300">
              Пути к файлам (по одному на строку)
              <textarea
                value={pathsText}
                onChange={(event) => setPathsText(event.target.value)}
                rows={6}
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-3 font-mono text-xs text-white"
              />
            </label>
            <label className="block text-sm text-gray-300">
              Содержимое pack.mcmeta
              <textarea
                value={packMetaText}
                onChange={(event) => setPackMetaText(event.target.value)}
                rows={7}
                spellCheck={false}
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-3 font-mono text-xs text-white"
              />
            </label>
          </section>
          <section className="space-y-4 rounded-xl border border-gray-700 bg-gray-900 p-5">
            <h4 className="font-semibold text-white">Версия и таблица pack_format</h4>
            <label className="block text-sm text-gray-300">
              Целевая версия
              <input
                value={targetVersion}
                onChange={(event) => setTargetVersion(event.target.value)}
                placeholder="Например, 1.21"
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white"
              />
            </label>
            <label className="block text-sm text-gray-300">
              Ваша таблица версий (JSON: версия → pack_format)
              <textarea
                value={mappingText}
                onChange={(event) => setMappingText(event.target.value)}
                rows={12}
                spellCheck={false}
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-3 font-mono text-xs text-white"
              />
            </label>
            {!versionMapping && (
              <p className="text-sm text-amber-300">Таблица не распознана. Исправьте JSON, чтобы сравнить формат.</p>
            )}
            <button type="button" onClick={validatePack} className="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500">
              Проверить пакет
            </button>
          </section>
        </div>

        {findings && (
          <section className="rounded-xl border border-gray-700 bg-gray-900 p-5" aria-live="polite">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h4 className="flex items-center gap-2 font-semibold text-white">
                <ShieldAlert className="h-5 w-5 text-amber-300" /> Результаты
              </h4>
              <button type="button" onClick={downloadReport} className="flex items-center gap-2 rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800">
                <Download className="h-4 w-4" /> Скачать JSON-отчёт
              </button>
            </div>
            <ul className="space-y-2">
              {findings.map((finding, index) => (
                <li key={`${finding.text}-${index}`} className={`rounded-md px-3 py-2 text-sm ${
                  finding.level === 'ошибка' ? 'bg-red-950 text-red-200' :
                    finding.level === 'предупреждение' ? 'bg-amber-950 text-amber-200' : 'bg-gray-800 text-gray-300'
                }`}>
                  <span className="mr-2 font-semibold">{finding.level.toUpperCase()}</span>{finding.text}
                </li>
              ))}
            </ul>
          </section>
        )}
        {status && <p role="status" className="text-sm text-gray-300">{status}</p>}
      </div>
    </TabLayout>
  );
};
