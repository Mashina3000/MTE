import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer as KonvaLayer, Image } from 'react-konva';
import Konva from 'konva';
import { useStore } from '@/store';
import { TabLayout } from '@/components/TabLayout';
import { useTranslation } from '@/locales/i18n';
import {
  Palette,
  Edit3,
  Trash2,
  Copy,
  Download,
  Upload,
  Maximize2,
  Grid3x3,
  Undo2,
  Redo2,
} from 'lucide-react';

export const TextureEditorTab: React.FC = () => {
  const { t } = useTranslation();
  const store = useStore();
  const stageRef = useRef<Konva.Stage | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(256);
  const [canvasHeight, setCanvasHeight] = useState(256);
  const [layers, setLayers] = useState([
    { id: 'layer-1', name: 'Layer 1', visible: true, locked: false, opacity: 1 },
  ]);
  const [selectedColor, setSelectedColor] = useState('#FF0000');
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // Рисование на холсте
  const handleCanvasDraw = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (store.currentTool !== 'brush') return;
    
    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const layer = stage.findOne('.drawing-layer') as Konva.Layer;
    if (!layer) return;

    const ctx = layer.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = selectedColor;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, store.brushSize, 0, Math.PI * 2);
    ctx.fill();
  };

  // Создать новый слой
  const createLayer = () => {
    const newLayer = {
      id: `layer-${Date.now()}`,
      name: `Layer ${layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
    };
    setLayers([newLayer, ...layers]);
  };

  // Дублировать слой
  const duplicateLayer = (layerId: string) => {
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;
    const newLayer = { ...layer, id: `layer-${Date.now()}` };
    setLayers([newLayer, ...layers]);
  };

  // Удалить слой
  const deleteLayer = (layerId: string) => {
    if (layers.length === 1) return;
    setLayers(layers.filter((l) => l.id !== layerId));
  };

  // Экспортировать как PNG
  const exportAsPNG = () => {
    const stage = stageRef.current;
    if (!stage) return;
    
    const uri = stage.toDataURL();
    const link = document.createElement('a');
    link.href = uri;
    link.download = `texture-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Импортировать изображение
  const handleImportImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setCanvasWidth(img.width);
        setCanvasHeight(img.height);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Пресеты размеров
  const setPresetSize = (size: number) => {
    setCanvasWidth(size);
    setCanvasHeight(size);
  };

  return (
    <TabLayout label={t('tabs.editor')} id={0} icon={<Edit3 />}>
      <div className="flex gap-4 h-full">
        {/* Левая панель - инструменты */}
        <div className="w-64 bg-gray-900 p-4 rounded border border-gray-700 flex flex-col gap-4">
          {/* Выбор инструмента */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-200">
              {t('tools.brush')}
            </label>
            <select
              value={store.currentTool}
              onChange={(e) => store.setCurrentTool(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded focus:border-blue-500"
            >
              <option value="brush">{t('tools.brush')}</option>
              <option value="eraser">{t('tools.eraser')}</option>
              <option value="fill">{t('tools.fill')}</option>
              <option value="eyedropper">{t('tools.eyedropper')}</option>
            </select>
          </div>

          {/* Размер кисти */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-200">
              Size: {store.brushSize}
            </label>
            <input
              type="range"
              min="1"
              max="64"
              value={store.brushSize}
              onChange={(e) => store.setBrushSize(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Жёсткость кисти */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-200">
              Hardness: {store.brushHardness}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={store.brushHardness}
              onChange={(e) => store.setBrushHardness(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Форма кисти */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-200">Shape</label>
            <div className="flex gap-2">
              {(['square', 'circle', 'diamond'] as const).map((shape) => (
                <button
                  key={shape}
                  onClick={() => store.setBrushShape(shape)}
                  className={`flex-1 px-2 py-2 rounded border text-xs font-semibold capitalize ${
                    store.brushShape === shape
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {shape}
                </button>
              ))}
            </div>
          </div>

          {/* Цвет */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-200">
              <Palette className="inline mr-2" size={16} />
              Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 text-white rounded text-xs"
              />
            </div>
          </div>

          {/* Симметрия */}
          <div className="flex gap-2">
            <button
              onClick={() => store.toggleSymmetryX()}
              className={`flex-1 px-2 py-2 rounded text-xs font-semibold ${
                store.isSymmetryX
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800 border border-gray-600 text-gray-300 hover:border-gray-500'
              }`}
            >
              Symmetry X
            </button>
            <button
              onClick={() => store.toggleSymmetryY()}
              className={`flex-1 px-2 py-2 rounded text-xs font-semibold ${
                store.isSymmetryY
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800 border border-gray-600 text-gray-300 hover:border-gray-500'
              }`}
            >
              Symmetry Y
            </button>
          </div>

          {/* Сетка */}
          <button
            onClick={() => store.toggleGridVisible()}
            className={`w-full px-3 py-2 rounded font-semibold flex items-center justify-center gap-2 ${
              store.gridVisible
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Grid3x3 size={16} />
            Grid
          </button>

          {/* Пресеты размеров */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-200">Preset Size</label>
            <div className="grid grid-cols-2 gap-2">
              {[16, 32, 64, 128, 256, 512].map((size) => (
                <button
                  key={size}
                  onClick={() => setPresetSize(size)}
                  className={`px-2 py-2 rounded text-xs font-semibold ${
                    canvasWidth === size && canvasHeight === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Действия */}
          <div className="flex gap-2">
            <button className="flex-1 px-2 py-2 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded text-xs font-semibold flex items-center justify-center gap-1">
              <Undo2 size={14} /> Undo
            </button>
            <button className="flex-1 px-2 py-2 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded text-xs font-semibold flex items-center justify-center gap-1">
              <Redo2 size={14} /> Redo
            </button>
          </div>
        </div>

        {/* Центральная панель - холст */}
        <div className="flex-1 flex flex-col bg-gray-900 p-4 rounded border border-gray-700">
          <div className="flex-1 overflow-auto bg-gray-950 rounded border border-gray-700">
            <Stage
              ref={stageRef}
              width={canvasWidth}
              height={canvasHeight}
              onMouseMove={handleCanvasDraw}
              className="cursor-crosshair"
            >
              <KonvaLayer className="drawing-layer">
                {/* Холст рисования будет здесь */}
              </KonvaLayer>
            </Stage>
          </div>
          <div className="mt-4 flex gap-2">
            <label className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer">
              <Upload size={16} />
              {t('actions.import')}
              <input
                type="file"
                accept="image/*"
                onChange={handleImportImage}
                className="hidden"
              />
            </label>
            <button
              onClick={exportAsPNG}
              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Download size={16} />
              {t('actions.export')}
            </button>
          </div>
        </div>

        {/* Правая панель - слои */}
        <div className="w-48 bg-gray-900 p-4 rounded border border-gray-700 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-200">Layers</h3>
            <button
              onClick={createLayer}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
            >
              +
            </button>
          </div>
          <div className="flex-1 overflow-auto space-y-2">
            {layers.map((layer) => (
              <div key={layer.id} className="p-2 bg-gray-800 rounded border border-gray-700 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-200 font-semibold">{layer.name}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => duplicateLayer(layer.id)}
                      className="p-1 hover:bg-gray-700 rounded"
                    >
                      <Copy size={12} className="text-gray-400" />
                    </button>
                    <button
                      onClick={() => deleteLayer(layer.id)}
                      className="p-1 hover:bg-gray-700 rounded"
                    >
                      <Trash2 size={12} className="text-gray-400" />
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={layer.opacity}
                  className="w-full"
                  title="Opacity"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </TabLayout>
  );
};
