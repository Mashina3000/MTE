import React, { useState, useEffect } from 'react';
import { useStore } from '@/store';
import { TabLayout } from '@/components/TabLayout';
import { useTranslation } from '@/locales/i18n';
import {
  Play,
  Pause,
  Plus,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  RotateCcw,
  Download,
} from 'lucide-react';

interface AnimFrame {
  id: string;
  duration: number;
  imageUrl?: string;
}

export const AnimationEditorTab: React.FC = () => {
  const { t } = useTranslation();
  const store = useStore();
  const [frames, setFrames] = useState<AnimFrame[]>([
    { id: '1', duration: 10 },
  ]);
  const [selectedFrameId, setSelectedFrameId] = useState('1');
  const [loopMode, setLoopMode] = useState<'loop' | 'once' | 'ping_pong'>('loop');

  // Получить текущий кадр
  const currentFrame = frames.find((f) => f.id === selectedFrameId);
  const currentFrameIndex = frames.findIndex((f) => f.id === selectedFrameId);

  // Добавить кадр
  const addFrame = () => {
    const newFrame: AnimFrame = {
      id: `frame-${Date.now()}`,
      duration: 10,
    };
    setFrames([...frames, newFrame]);
    setSelectedFrameId(newFrame.id);
  };

  // Удалить кадр
  const deleteFrame = (frameId: string) => {
    if (frames.length === 1) return;
    const newFrames = frames.filter((f) => f.id !== frameId);
    setFrames(newFrames);
    setSelectedFrameId(newFrames[0].id);
  };

  // Дублировать кадр
  const duplicateFrame = (frameId: string) => {
    const frame = frames.find((f) => f.id === frameId);
    if (!frame) return;
    const newFrame: AnimFrame = {
      ...frame,
      id: `frame-${Date.now()}`,
    };
    const index = frames.findIndex((f) => f.id === frameId);
    setFrames([...frames.slice(0, index + 1), newFrame, ...frames.slice(index + 1)]);
  };

  // Переместить кадр
  const moveFrame = (frameId: string, direction: 'up' | 'down') => {
    const index = frames.findIndex((f) => f.id === frameId);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === frames.length - 1)) {
      return;
    }
    const newFrames = [...frames];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newFrames[index], newFrames[targetIndex]] = [newFrames[targetIndex], newFrames[index]];
    setFrames(newFrames);
  };

  // Изменить длительность кадра
  const setFrameDuration = (frameId: string, duration: number) => {
    setFrames(
      frames.map((f) =>
        f.id === frameId ? { ...f, duration } : f
      )
    );
  };

  // Экспортировать .mcmeta
  const exportMcmeta = () => {
    const mcmeta = {
      animation: {
        frametime: store.fps,
        interpolate: true,
        frames: frames.map((f, i) => ({
          index: i,
          time: f.duration,
        })),
      },
    };
    const blob = new Blob([JSON.stringify(mcmeta, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `texture.png.mcmeta`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <TabLayout label={t('tabs.animation')} id={1} icon={<Play />}>
      <div className="flex flex-col gap-4 h-full">
        {/* Предпросмотр текущего кадра */}
        <div className="flex-1 bg-gray-900 p-4 rounded border border-gray-700">
          <div className="w-full h-full bg-gray-950 rounded border border-gray-700 flex items-center justify-center">
            {currentFrame?.imageUrl ? (
              <img
                src={currentFrame.imageUrl}
                alt="Frame preview"
                className="max-w-full max-h-full"
              />
            ) : (
              <div className="text-gray-500 text-center">
                <div className="text-sm">Frame {currentFrameIndex + 1} preview</div>
                <div className="text-xs mt-2">No image loaded</div>
              </div>
            )}
          </div>
        </div>

        {/* Панель управления */}
        <div className="bg-gray-900 p-4 rounded border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-sm flex items-center gap-2">
                <Play size={16} />
                {store.fps} FPS
              </button>
              <select
                value={loopMode}
                onChange={(e) => setLoopMode(e.target.value as any)}
                className="px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded text-sm"
              >
                <option value="loop">Loop</option>
                <option value="once">Once</option>
                <option value="ping_pong">Ping Pong</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="range"
                min="1"
                max="120"
                value={store.fps}
                onChange={(e) => store.setFps(Number(e.target.value))}
                className="w-32"
              />
              <button
                onClick={exportMcmeta}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-sm flex items-center gap-2"
              >
                <Download size={16} />
                Export .mcmeta
              </button>
            </div>
          </div>

          {/* Таймлайн кадров */}
          <div className="bg-gray-800 p-3 rounded border border-gray-700">
            <div className="text-xs font-semibold text-gray-300 mb-3">Timeline</div>
            <div className="flex overflow-x-auto gap-2 pb-2">
              {frames.map((frame, idx) => (
                <div
                  key={frame.id}
                  className={`flex-shrink-0 flex flex-col items-center gap-1`}
                >
                  <button
                    onClick={() => setSelectedFrameId(frame.id)}
                    className={`w-16 h-16 rounded border-2 text-xs font-semibold flex items-center justify-center ${
                      selectedFrameId === frame.id
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-center">
                      <div>{idx + 1}</div>
                      <div className="text-xs">{frame.duration}ms</div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Кадры и их параметры */}
        <div className="grid grid-cols-2 gap-4">
          {/* Список кадров */}
          <div className="bg-gray-900 p-4 rounded border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-200">Frames</h3>
              <button
                onClick={addFrame}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1"
              >
                <Plus size={14} />
                Add
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {frames.map((frame, idx) => (
                <div
                  key={frame.id}
                  className={`p-3 rounded border text-xs ${
                    selectedFrameId === frame.id
                      ? 'bg-blue-900 border-blue-600'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div
                    onClick={() => setSelectedFrameId(frame.id)}
                    className="cursor-pointer font-semibold text-gray-200 mb-2"
                  >
                    Frame {idx + 1}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => moveFrame(frame.id, 'up')}
                      disabled={idx === 0}
                      className="p-1 hover:bg-gray-700 rounded disabled:opacity-50"
                    >
                      <ChevronLeft size={12} className="text-gray-400" />
                    </button>
                    <button
                      onClick={() => moveFrame(frame.id, 'down')}
                      disabled={idx === frames.length - 1}
                      className="p-1 hover:bg-gray-700 rounded disabled:opacity-50"
                    >
                      <ChevronRight size={12} className="text-gray-400" />
                    </button>
                    <button
                      onClick={() => duplicateFrame(frame.id)}
                      className="p-1 hover:bg-gray-700 rounded"
                    >
                      <Copy size={12} className="text-gray-400" />
                    </button>
                    <button
                      onClick={() => deleteFrame(frame.id)}
                      className="p-1 hover:bg-gray-700 rounded"
                    >
                      <Trash2 size={12} className="text-gray-400" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400">Duration:</label>
                    <input
                      type="number"
                      min="1"
                      value={frame.duration}
                      onChange={(e) => setFrameDuration(frame.id, Number(e.target.value))}
                      className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 text-white rounded text-xs"
                    />
                    <span className="text-xs text-gray-400">ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Параметры анимации */}
          <div className="bg-gray-900 p-4 rounded border border-gray-700">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">Animation Settings</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-gray-400 mb-1">Total Frames: {frames.length}</label>
              </div>
              <div>
                <label className="block text-gray-400 mb-1">
                  Total Duration: {frames.reduce((acc, f) => acc + f.duration, 0)}ms
                </label>
              </div>
              <div>
                <label className="block text-gray-400 mb-2">Current Frame Duration</label>
                {currentFrame && (
                  <input
                    type="number"
                    min="1"
                    value={currentFrame.duration}
                    onChange={(e) => setFrameDuration(currentFrame.id, Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded"
                  />
                )}
              </div>
              <div>
                <label className="block text-gray-400 mb-2">Loop Mode</label>
                <select
                  value={loopMode}
                  onChange={(e) => setLoopMode(e.target.value as any)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded"
                >
                  <option value="loop">Loop</option>
                  <option value="once">Play Once</option>
                  <option value="ping_pong">Ping Pong</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 mb-2">FPS: {store.fps}</label>
                <input
                  type="range"
                  min="1"
                  max="120"
                  value={store.fps}
                  onChange={(e) => store.setFps(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </TabLayout>
  );
};
