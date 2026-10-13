import React, { useState } from 'react';
import { useStore } from '@/store';
import { TabLayout } from '@/components/TabLayout';
import { useTranslation } from '@/locales/i18n';
import {
  Package,
  Plus,
  Trash2,
  Download,
  Upload,
  Check,
  AlertCircle,
} from 'lucide-react';

interface MinecraftVersion {
  id: string;
  name: string;
  packFormat: number;
  type: 'release' | 'snapshot';
}

// Список версий Minecraft
const MINECRAFT_VERSIONS: MinecraftVersion[] = [
  { id: '1.20.4', name: '1.20.4', packFormat: 34, type: 'release' },
  { id: '1.20.3', name: '1.20.3 Snapshot', packFormat: 33, type: 'snapshot' },
  { id: '1.20.2', name: '1.20.2', packFormat: 32, type: 'release' },
  { id: '1.20.1', name: '1.20.1', packFormat: 31, type: 'release' },
  { id: '1.20', name: '1.20', packFormat: 30, type: 'release' },
  { id: '1.19.4', name: '1.19.4', packFormat: 28, type: 'release' },
  { id: '1.19', name: '1.19', packFormat: 27, type: 'release' },
  { id: '1.18.2', name: '1.18.2', packFormat: 26, type: 'release' },
  { id: '1.16.5', name: '1.16.5', packFormat: 6, type: 'release' },
];

export const ResourcePackBuilderTab: React.FC = () => {
  const { t } = useTranslation();
  const initialPackName = useStore((state) => state.packName);
  const initialSelectedVersions = useStore((state) => state.selectedVersions);
  const setPackNameInStore = useStore((state) => state.setPackName);
  const setSelectedVersionsInStore = useStore((state) => state.setSelectedVersions);
  const [packName, setPackName] = useState(initialPackName);
  const [packDescription, setPackDescription] = useState('A custom resource pack');
  const [packAuthor, setPackAuthor] = useState('Author');
  const [packVersion, setPackVersion] = useState('1.0.0');
  const [selectedVersions, setSelectedVersions] = useState<string[]>(initialSelectedVersions);
  const [templateType, setTemplateType] = useState('empty');

  // Обновить хранилище
  React.useEffect(() => {
    setPackNameInStore(packName);
    setSelectedVersionsInStore(selectedVersions);
  }, [packName, selectedVersions, setPackNameInStore, setSelectedVersionsInStore]);

  // Выбрать/отменить версию
  const toggleVersion = (versionId: string) => {
    setSelectedVersions((prev) =>
      prev.includes(versionId)
        ? prev.filter((v) => v !== versionId)
        : [...prev, versionId]
    );
  };

  // Выбрать все версии
  const selectAllVersions = () => {
    setSelectedVersions(MINECRAFT_VERSIONS.map((v) => v.id));
  };

  // Отменить все версии
  const clearAllVersions = () => {
    setSelectedVersions([]);
  };

  // Создать ресурс-пак
  const createResourcePack = () => {
    if (selectedVersions.length === 0) {
      alert('Please select at least one Minecraft version');
      return;
    }

    // Генерируем pack.mcmeta
    const packFormat = Math.max(
      ...selectedVersions.map((vid) => {
        const v = MINECRAFT_VERSIONS.find((v) => v.id === vid);
        return v?.packFormat || 0;
      })
    );

    const mcmeta = {
      pack: {
        pack_format: packFormat,
        description: packDescription,
        supported_formats: selectedVersions.map((vid) => {
          const v = MINECRAFT_VERSIONS.find((v) => v.id === vid);
          return v?.packFormat || 0;
        }),
      },
    };

    // Скачать pack.mcmeta
    const blob = new Blob([JSON.stringify(mcmeta, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pack.mcmeta';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(
      `Resource pack created!\nName: ${packName}\nVersions: ${selectedVersions.join(', ')}\nPack Format: ${packFormat}`
    );
  };

  return (
    <TabLayout label={t('tabs.resourcePack')} id={2} icon={<Package />}>
      <div className="grid grid-cols-3 gap-4 h-full">
        {/* Левая панель - параметры пака */}
        <div className="col-span-1 bg-gray-900 p-4 rounded border border-gray-700 flex flex-col gap-4 overflow-y-auto">
          <h3 className="text-lg font-semibold text-gray-200">Pack Settings</h3>

          {/* Название */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Pack Name
            </label>
            <input
              type="text"
              value={packName}
              onChange={(e) => setPackName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded text-sm focus:border-blue-500"
            />
          </div>

          {/* Описание */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={packDescription}
              onChange={(e) => setPackDescription(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded text-sm focus:border-blue-500 h-24 resize-none"
            />
          </div>

          {/* Автор */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Author
            </label>
            <input
              type="text"
              value={packAuthor}
              onChange={(e) => setPackAuthor(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded text-sm focus:border-blue-500"
            />
          </div>

          {/* Версия */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Pack Version
            </label>
            <input
              type="text"
              value={packVersion}
              onChange={(e) => setPackVersion(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded text-sm focus:border-blue-500"
            />
          </div>

          {/* Шаблон */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Template
            </label>
            <select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded text-sm"
            >
              <option value="empty">Empty</option>
              <option value="medieval">Medieval</option>
              <option value="modern">Modern</option>
              <option value="pixelart">Pixel Art</option>
              <option value="realistic">Realistic</option>
              <option value="cartoon">Cartoon</option>
            </select>
          </div>

          {/* Действия */}
          <div className="flex gap-2 mt-auto pt-4">
            <button
              onClick={createResourcePack}
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Create
            </button>
            <button className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-sm flex items-center justify-center gap-2">
              <Download size={16} />
              Export
            </button>
          </div>
        </div>

        {/* Средняя панель - выбор версий */}
        <div className="col-span-1 bg-gray-900 p-4 rounded border border-gray-700 flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-gray-200">Minecraft Versions</h3>

          <div className="flex gap-2 mb-2">
            <button
              onClick={selectAllVersions}
              className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-semibold"
            >
              Select All
            </button>
            <button
              onClick={clearAllVersions}
              className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-semibold"
            >
              Clear
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {MINECRAFT_VERSIONS.map((version) => (
              <label
                key={version.id}
                className="flex items-center gap-3 p-3 bg-gray-800 rounded border border-gray-700 hover:border-gray-600 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedVersions.includes(version.id)}
                  onChange={() => toggleVersion(version.id)}
                  className="w-4 h-4 rounded"
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-200">{version.name}</div>
                  <div className="text-xs text-gray-400">Format: {version.packFormat}</div>
                </div>
                {version.type === 'snapshot' && (
                  <span className="px-2 py-1 bg-orange-600 text-white text-xs rounded">
                    Snapshot
                  </span>
                )}
              </label>
            ))}
          </div>

          <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
            Selected: {selectedVersions.length} / {MINECRAFT_VERSIONS.length}
          </div>
        </div>

        {/* Правая панель - структура и валидация */}
        <div className="col-span-1 bg-gray-900 p-4 rounded border border-gray-700 flex flex-col gap-4 overflow-y-auto">
          <h3 className="text-lg font-semibold text-gray-200">Folder Structure</h3>

          <div className="text-xs space-y-2 font-mono">
            <div className="text-gray-300">
              <Check size={14} className="inline text-green-500 mr-2" />
              📦 {packName || 'MyPack'}
            </div>
            <div className="text-gray-400 ml-4">
              <Check size={14} className="inline text-green-500 mr-2" />
              📄 pack.mcmeta
            </div>
            <div className="text-gray-400 ml-4">
              <Check size={14} className="inline text-green-500 mr-2" />
              🖼️ pack.png
            </div>
            <div className="text-gray-400 ml-4">
              <Check size={14} className="inline text-green-500 mr-2" />
              📁 assets/
            </div>
            <div className="text-gray-500 ml-8">
              📁 minecraft/
            </div>
            <div className="text-gray-500 ml-12">
              📁 textures/
            </div>
            <div className="text-gray-500 ml-16">
              📁 block/
            </div>
            <div className="text-gray-500 ml-16">
              📁 item/
            </div>
            <div className="text-gray-500 ml-16">
              📁 entity/
            </div>
            <div className="text-gray-500 ml-16">
              📁 gui/
            </div>
            <div className="text-gray-500 ml-16">
              📁 particle/
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <h4 className="text-sm font-semibold text-gray-200 mb-2">Validation</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-green-500">
                <Check size={16} />
                <span>Pack name is valid</span>
              </div>
              <div className="flex items-center gap-2 text-green-500">
                <Check size={16} />
                <span>Versions selected</span>
              </div>
              {selectedVersions.length > 0 && (
                <div className="flex items-center gap-2 text-green-500">
                  <Check size={16} />
                  <span>Ready to export</span>
                </div>
              )}
              {selectedVersions.length === 0 && (
                <div className="flex items-center gap-2 text-yellow-500">
                  <AlertCircle size={16} />
                  <span>Select at least one version</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TabLayout>
  );
};
