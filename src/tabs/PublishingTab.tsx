import React, { useRef, useState } from 'react';
import JSZip from 'jszip';
import { Archive, Check, Download, FileText, FolderOpen } from 'lucide-react';
import { TabLayout } from '@/components/TabLayout';

type LicenseChoice = 'MIT' | 'CC BY-NC 4.0' | 'Все права защищены';
type Channel = 'Стабильный релиз' | 'Предварительный выпуск' | 'Снимок разработки';

const MANUAL_CHECKLISTS = {
  CurseForge: [
    'Создайте проект типа Resource Packs в веб-панели CurseForge.',
    'Добавьте ZIP-архив в новую версию файла и заполните описание.',
    'Укажите поддерживаемые версии Minecraft и лицензию.',
    'Проверьте категорию, изображения и требования платформы перед отправкой.',
  ],
  Modrinth: [
    'Создайте проект типа Resource Pack в веб-панели Modrinth.',
    'Загрузите ZIP как новую версию и укажите канал выпуска.',
    'Выберите поддерживаемые версии игры и лицензию.',
    'Проверьте описание и видимость проекта перед публикацией.',
  ],
  'Planet Minecraft': [
    'Создайте публикацию типа Texture Pack на сайте Planet Minecraft.',
    'Загрузите ZIP-архив и подготовьте скриншоты/обложку.',
    'Укажите версию, описание и правила использования.',
    'Проверьте публикацию в предпросмотре сайта перед отправкой.',
  ],
};

function safeArchivePath(path: string) {
  const normalized = path.replace(/\\/g, '/').split('/').filter((part) => part && part !== '.');
  if (normalized.some((part) => part === '..') || normalized[0]?.includes(':')) return '';
  return normalized.join('/');
}

export const PublishingTab: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('Мой ресурс-пак');
  const [version, setVersion] = useState('1.0.0');
  const [channel, setChannel] = useState<Channel>('Стабильный релиз');
  const [gameVersion, setGameVersion] = useState('1.21');
  const [packFormat, setPackFormat] = useState('34');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [changelog, setChangelog] = useState('- Первый выпуск');
  const [license, setLicense] = useState<LicenseChoice>('Все права защищены');
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const readme = `# ${name || 'Ресурс-пак'}\n\n${description || 'Описание не добавлено.'}\n\n- Версия пакета: ${version || 'не указана'}\n- Minecraft: ${gameVersion || 'не указана'} (pack_format ${packFormat || 'не указан'})\n- Канал: ${channel}\n- Автор: ${author || 'не указан'}\n- Лицензия: ${license}\n\n## Установка\nРаспакуйте архив в папку resourcepacks и выберите пакет в настройках Minecraft.\n\nПодготовлено локально в Minecraft Texture Editor.`;

  const licenseNotice = `${name || 'Ресурс-пак'} — ${license}\nАвтор: ${author || 'не указан'}\n\n${
    license === 'MIT'
      ? 'Использование, копирование, изменение и распространение разрешены при сохранении этого уведомления. Это краткое уведомление, а не полный текст лицензии.'
      : license === 'CC BY-NC 4.0'
        ? 'Указание авторства обязательно; коммерческое использование не разрешено. Полные условия: https://creativecommons.org/licenses/by-nc/4.0/ . Это краткое уведомление, а не полный текст лицензии.'
        : 'Все права на этот ресурс-пак сохраняются за автором. Для использования или распространения запросите разрешение.'
}`;

  const loadFiles = (selected: FileList | null) => {
    const nextFiles = selected ? Array.from(selected) : [];
    setFiles(nextFiles);
    setMessage(nextFiles.length ? `Выбрано файлов локально: ${nextFiles.length}.` : 'Список файлов очищен.');
  };

  const createBundle = async () => {
    if (!name.trim() || !version.trim()) {
      setMessage('Укажите название пакета и версию.');
      return;
    }
    if (!/^\d+$/.test(packFormat) || Number(packFormat) < 1) {
      setMessage('pack_format должен быть положительным целым числом.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const zip = new JSZip();
      const root = safeArchivePath(name.trim()) || 'resource-pack';
      for (const file of files) {
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const pathParts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
        const pathWithoutRoot = pathParts.length > 1 ? pathParts.slice(1).join('/') : relativePath;
        const safePath = safeArchivePath(pathWithoutRoot);
        if (!safePath) continue;
        zip.file(`${root}/${safePath}`, file);
      }
      const meta = {
        pack: {
          pack_format: Number(packFormat),
          description: description.trim() || name.trim(),
        },
      };
      zip.file(`${root}/pack.mcmeta`, `${JSON.stringify(meta, null, 2)}\n`);
      zip.file(`${root}/README.md`, readme);
      zip.file(`${root}/CHANGELOG.md`, `# Журнал изменений\n\n## ${version} — ${channel}\n\n${changelog.trim() || '- Изменения не указаны.'}\n`);
      zip.file(`${root}/LICENSE.txt`, licenseNotice);
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${root.replace(/[\\/:*?"<>|]/g, '-')}-${version}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('ZIP-архив подготовлен и сохранён локально. Для публикации загрузите его вручную на выбранную платформу.');
    } catch (error) {
      setMessage(error instanceof Error ? `Не удалось собрать ZIP: ${error.message}` : 'Не удалось собрать ZIP-архив.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <TabLayout id={10} label="Подготовка к публикации" icon={<Archive className="h-5 w-5" />}>
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-xl border border-gray-700 bg-gray-900 p-5">
          <h3 className="text-xl font-semibold text-white">Локальная подготовка релиза</h3>
          <p className="mt-2 text-sm text-gray-400">
            Соберите ZIP с метаданными и документацией на этом устройстве. Загрузка на CurseForge, Modrinth и другие сайты выполняется вами вручную — подключений к платформам нет.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="space-y-4 rounded-xl border border-gray-700 bg-gray-900 p-5">
            <h4 className="font-semibold text-white">Метаданные релиза</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-gray-300">Название
                <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white" />
              </label>
              <label className="text-sm text-gray-300">Версия пакета
                <input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="1.0.0" className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white" />
              </label>
              <label className="text-sm text-gray-300">Канал
                <select value={channel} onChange={(event) => setChannel(event.target.value as Channel)} className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white">
                  {(['Стабильный релиз', 'Предварительный выпуск', 'Снимок разработки'] as Channel[]).map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label className="text-sm text-gray-300">Minecraft
                <input value={gameVersion} onChange={(event) => setGameVersion(event.target.value)} className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white" />
              </label>
              <label className="text-sm text-gray-300">pack_format
                <input value={packFormat} onChange={(event) => setPackFormat(event.target.value)} inputMode="numeric" className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white" />
              </label>
              <label className="text-sm text-gray-300">Автор
                <input value={author} onChange={(event) => setAuthor(event.target.value)} className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white" />
              </label>
            </div>
            <label className="block text-sm text-gray-300">Краткое описание
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-3 text-white" />
            </label>
            <label className="block text-sm text-gray-300">Журнал изменений
              <textarea value={changelog} onChange={(event) => setChangelog(event.target.value)} rows={4} className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-3 text-white" />
            </label>
            <label className="block text-sm text-gray-300">Уведомление о лицензии
              <select value={license} onChange={(event) => setLicense(event.target.value as LicenseChoice)} className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white">
                {(['Все права защищены', 'MIT', 'CC BY-NC 4.0'] as LicenseChoice[]).map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          </section>

          <div className="space-y-5">
            <section className="space-y-4 rounded-xl border border-gray-700 bg-gray-900 p-5">
              <h4 className="font-semibold text-white">Содержимое пакета</h4>
              <p className="text-sm text-gray-400">Выберите папку ресурс-пака. Файлы будут включены в ZIP; pack.mcmeta, README, журнал и уведомление о лицензии будут сгенерированы.</p>
              <input
                ref={(element) => {
                  fileInputRef.current = element;
                  if (element) element.setAttribute('webkitdirectory', '');
                }}
                type="file"
                multiple
                onChange={(event) => loadFiles(event.target.files)}
                className="hidden"
              />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-gray-600 p-4 text-sm text-gray-200 hover:bg-gray-800">
                <FolderOpen className="h-5 w-5" /> Выбрать папку пакета
              </button>
              <p className="text-xs text-gray-400">{files.length ? `Файлов выбрано: ${files.length}` : 'Пока не выбрана ни одна папка.'}</p>
              <button type="button" disabled={busy} onClick={() => { void createBundle(); }} className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-3 font-medium text-white hover:bg-emerald-600 disabled:cursor-wait disabled:opacity-60">
                <Download className="h-5 w-5" /> {busy ? 'Сборка архива…' : 'Собрать и скачать ZIP'}
              </button>
              {message && <p role="status" className="text-sm text-gray-300">{message}</p>}
            </section>
            <section className="rounded-xl border border-gray-700 bg-gray-900 p-5">
              <h4 className="mb-3 flex items-center gap-2 font-semibold text-white"><FileText className="h-5 w-5" /> Предпросмотр README</h4>
              <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-md bg-gray-950 p-3 text-xs leading-5 text-gray-300">{readme}</pre>
            </section>
          </div>
        </div>

        <section className="rounded-xl border border-gray-700 bg-gray-900 p-5">
          <h4 className="mb-4 font-semibold text-white">Ручная публикация — чек-лист</h4>
          <div className="grid gap-4 lg:grid-cols-3">
            {Object.entries(MANUAL_CHECKLISTS).map(([platform, items]) => (
              <div key={platform} className="rounded-lg bg-gray-800 p-4">
                <h5 className="mb-3 font-medium text-white">{platform}</h5>
                <ul className="space-y-2">
                  {items.map((item) => <li key={item} className="flex gap-2 text-sm leading-5 text-gray-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </TabLayout>
  );
};
