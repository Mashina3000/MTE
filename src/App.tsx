import React, { useEffect } from 'react';
import { useStore } from '@/store';
import { TextureEditorTab } from '@/tabs/TextureEditorTab';
import { AnimationEditorTab } from '@/tabs/AnimationEditorTab';
import { ResourcePackBuilderTab } from '@/tabs/ResourcePackBuilderTab';
import { Preview3DTab } from '@/tabs/Preview3DTab';
import { FileManagerTab } from '@/tabs/FileManagerTab';
import { applySavedSettingsAppearance, SettingsTab } from '@/tabs/SettingsTab';
import { PluginsTab } from '@/tabs/PluginsTab';
import { ImportExportTab } from '@/tabs/ImportExportTab';
import { AIAssistantTab } from '@/tabs/AIAssistantTab';
import { CompatibilityTab } from '@/tabs/CompatibilityTab';
import { PublishingTab } from '@/tabs/PublishingTab';
import { CollaborationTab } from '@/tabs/CollaborationTab';
import { appendConsoleLog, ConsoleTab } from '@/tabs/ConsoleTab';
import { HelpTab } from '@/tabs/HelpTab';
import { useTranslation } from '@/locales/i18n';
import {
  Edit3,
  Play,
  Package,
  Cube,
  FileText,
  Settings,
  Zap,
  Download,
  Wand2,
  CheckCircle,
  Send,
  Users,
  Terminal,
  HelpCircle,
} from 'lucide-react';

interface Tab {
  id: number;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  badge?: number;
}

export const App: React.FC = () => {
  const { t } = useTranslation();
  const { activeTab, setActiveTab } = useStore();

  useEffect(() => {
    applySavedSettingsAppearance();
  }, []);

  // Список всех вкладок
  const tabs: Tab[] = [
    {
      id: 0,
      label: t('tabs.editor'),
      icon: <Edit3 size={20} />,
      component: <TextureEditorTab />,
    },
    {
      id: 1,
      label: t('tabs.animation'),
      icon: <Play size={20} />,
      component: <AnimationEditorTab />,
    },
    {
      id: 2,
      label: t('tabs.resourcePack'),
      icon: <Package size={20} />,
      component: <ResourcePackBuilderTab />,
    },
    {
      id: 3,
      label: t('tabs.preview3d'),
      icon: <Cube size={20} />,
      component: <Preview3DTab />,
    },
    {
      id: 4,
      label: t('tabs.files'),
      icon: <FileText size={20} />,
      component: <FileManagerTab />,
    },
    {
      id: 5,
      label: t('tabs.settings'),
      icon: <Settings size={20} />,
      component: <SettingsTab />,
    },
    {
      id: 6,
      label: t('tabs.plugins'),
      icon: <Zap size={20} />,
      component: <PluginsTab />,
    },
    {
      id: 7,
      label: t('tabs.importExport'),
      icon: <Download size={20} />,
      component: <ImportExportTab />,
    },
    {
      id: 8,
      label: t('tabs.aiAssistant'),
      icon: <Wand2 size={20} />,
      component: <AIAssistantTab />,
    },
    {
      id: 9,
      label: t('tabs.compatibility'),
      icon: <CheckCircle size={20} />,
      component: <CompatibilityTab />,
    },
    {
      id: 10,
      label: t('tabs.publishing'),
      icon: <Send size={20} />,
      component: <PublishingTab />,
    },
    {
      id: 11,
      label: t('tabs.collaboration'),
      icon: <Users size={20} />,
      component: <CollaborationTab />,
    },
    {
      id: 12,
      label: t('tabs.console'),
      icon: <Terminal size={20} />,
      component: <ConsoleTab />,
    },
    {
      id: 13,
      label: t('tabs.help'),
      icon: <HelpCircle size={20} />,
      component: <HelpTab />,
    },
  ];

  // Обработка горячих клавиш Ctrl+1...Ctrl+9
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex < tabs.length) {
          e.preventDefault();
          setActiveTab(tabIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs.length, setActiveTab]);

  const currentTab = tabs[activeTab];

  useEffect(() => {
    if (currentTab) appendConsoleLog('info', `Открыта вкладка: ${currentTab.label}`);
  }, [currentTab?.label]);

  return (
    <div className="flex flex-col w-screen h-screen bg-gray-900">
      {/* Заголовок */}
      <header className="bg-gray-950 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold text-blue-500">⛏️</div>
          <h1 className="text-xl font-bold text-white">Minecraft Texture Editor</h1>
          <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded">Beta v0.1.0</span>
        </div>
        <div className="text-xs text-gray-400">
          Ctrl+1...Ctrl+9 для переключения вкладок
        </div>
      </header>

      {/* Вкладки */}
      <div className="bg-gray-900 border-b border-gray-700 px-2 py-2 flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded whitespace-nowrap font-semibold text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge && (
              <span className="ml-1 px-2 py-1 bg-red-600 text-white rounded-full text-xs font-bold">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Содержимое вкладки */}
      <main className="flex-1 overflow-hidden">
        {currentTab && currentTab.component}
      </main>

      {/* Статус бар */}
      <footer className="bg-gray-950 border-t border-gray-700 px-6 py-2 flex items-center justify-between text-xs text-gray-400">
        <div>Ready</div>
        <div>
          Current Tab: {currentTab?.label} ({activeTab + 1}/{tabs.length})
        </div>
      </footer>
    </div>
  );
};

export default App;
