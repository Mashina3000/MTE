import React, { useRef, useState } from 'react';
import { Group, Image as KonvaImage, Layer as KonvaLayer, Line, Rect, Stage } from 'react-konva';
import Konva from 'konva';
import { useStore } from '@/store';
import { TabLayout } from '@/components/TabLayout';
import { useTranslation } from '@/locales/i18n';
import {
  Copy,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Grid3x3,
  Layers,
  Minus,
  Palette,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';

interface DrawingLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
}

interface Stroke {
  id: string;
  layerId: string;
  points: number[];
  color: string;
  width: number;
  tool: 'brush' | 'eraser';
  cap: 'round' | 'square';
  opacity: number;
}

const INITIAL_LAYER_ID = 'layer-1';

export const TextureEditorTab: React.FC = () => {
  const { t } = useTranslation();
  const currentTool = useStore((state) => state.currentTool);
  const brushSize = useStore((state) => state.brushSize);
  const brushShape = useStore((state) => state.brushShape);
  const brushHardness = useStore((state) => state.brushHardness);
  const gridVisible = useStore((state) => state.gridVisible);
  const setCurrentTool = useStore((state) => state.setCurrentTool);
  const setBrushSize = useStore((state) => state.setBrushSize);
  const setBrushShape = useStore((state) => state.setBrushShape);
  const setBrushHardness = useStore((state) => state.setBrushHardness);
  const toggleGridVisible = useStore((state) => state.toggleGridVisible);

  const stageRef = useRef<Konva.Stage | null>(null);
  const drawingRef = useRef(false);
  const [canvasWidth, setCanvasWidth] = useState(256);
  const [canvasHeight, setCanvasHeight] = useState(256);
  const [layers, setLayers] = useState<DrawingLayer[]>([
    { id: INITIAL_LAYER_ID, name: 'Слой 1', visible: true, opacity: 1 },
  ]);
  const [activeLayerId, setActiveLayerId] = useState(INITIAL_LAYER_ID);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStrokes, setRedoStrokes] = useState<Stroke[]>([]);
  const [selectedColor, setSelectedColor] = useState('#39B56B');
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null);
  const [importedImage, setImportedImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState('Готово к рисованию');

  const zoom = Math.max(1, Math.min(4, 520 / Math.max(canvasWidth, canvasHeight)));
  const stageWidth = Math.round(canvasWidth * zoom);
  const stageHeight = Math.round(canvasHeight * zoom);
  const selectedLayer = layers.find((layer) => layer.id === activeLayerId);

  const getCanvasPoint = () => {
    const point = stageRef.current?.getPointerPosition();
    if (!point) return null;
    return { x: point.x / zoom, y: point.y / zoom };
  };

  const startDrawing = () => {
    const point = getCanvasPoint();
    if (!point || !selectedLayer?.visible) return;

    if (currentTool === 'fill') {
      setBackgroundColor(selectedColor);
      setStatus('Заливка применена');
      return;
    }
    if (currentTool === 'eyedropper') {
      const context = stageRef.current?.toCanvas().getContext('2d');
      if (!context) {
        setStatus('Не удалось прочитать цвет с холста');
        return;
      }
      const pixel = context.getImageData(
        Math.max(0, Math.min(stageWidth - 1, Math.floor(point.x * zoom))),
        Math.max(0, Math.min(stageHeight - 1, Math.floor(point.y * zoom))),
        1,
        1
      ).data;
      if (pixel[3] === 0) {
        setStatus('В этой точке прозрачный пиксель');
        return;
      }
      setSelectedColor(`#${Array.from(pixel.slice(0, 3), (value) => value.toString(16).padStart(2, '0')).join('')}`);
      setStatus('Цвет выбран пипеткой');
      return;
    }
    if (currentTool !== 'brush' && currentTool !== 'eraser') return;

    drawingRef.current = true;
    setRedoStrokes([]);
    setStrokes((current) => [
      ...current,
      {
        id: `stroke-${Date.now()}-${current.length}`,
        layerId: activeLayerId,
        points: [point.x, point.y, point.x, point.y],
        color: selectedColor,
        width: brushSize,
        tool: currentTool,
        cap: brushShape === 'square' ? 'square' : 'round',
        opacity: brushHardness / 100,
      },
    ]);
  };

  const continueDrawing = () => {
    if (!drawingRef.current) return;
    const point = getCanvasPoint();
    if (!point) return;
    setStrokes((current) => {
      const lastStroke = current[current.length - 1];
      if (!lastStroke || lastStroke.layerId !== activeLayerId) return current;
      const updated = [...current];
      updated[updated.length - 1] = {
        ...lastStroke,
        points: [...lastStroke.points, point.x, point.y],
      };
      return updated;
    });
  };

  const stopDrawing = () => {
    drawingRef.current = false;
  };

  const createLayer = () => {
    const layer = {
      id: `layer-${Date.now()}`,
      name: `Слой ${layers.length + 1}`,
      visible: true,
      opacity: 1,
    };
    setLayers((current) => [...current, layer]);
    setActiveLayerId(layer.id);
  };

  const duplicateLayer = (layerId: string) => {
    const source = layers.find((layer) => layer.id === layerId);
    if (!source) return;
    const id = `layer-${Date.now()}`;
    setLayers((current) => [...current, { ...source, id, name: `${source.name} копия` }]);
    setStrokes((current) => [
      ...current,
      ...current.filter((stroke) => stroke.layerId === layerId).map((stroke) => ({
        ...stroke,
        id: `${stroke.id}-copy-${id}`,
        layerId: id,
      })),
    ]);
    setActiveLayerId(id);
  };

  const deleteLayer = (layerId: string) => {
    if (layers.length <= 1) return;
    const nextLayers = layers.filter((layer) => layer.id !== layerId);
    setLayers(nextLayers);
    setStrokes((current) => current.filter((stroke) => stroke.layerId !== layerId));
    if (activeLayerId === layerId) setActiveLayerId(nextLayers[0].id);
  };

  const undo = () => {
    const lastStroke = strokes[strokes.length - 1];
    if (!lastStroke) return;
    setStrokes((current) => current.slice(0, -1));
    setRedoStrokes((current) => [...current, lastStroke]);
  };

  const redo = () => {
    const lastRedo = redoStrokes[redoStrokes.length - 1];
    if (!lastRedo) return;
    setRedoStrokes((current) => current.slice(0, -1));
    setStrokes((current) => [...current, lastRedo]);
  };

  const importImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => setStatus('Не удалось прочитать файл изображения');
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setStatus('Не удалось прочитать файл изображения');
        return;
      }
      const image = new window.Image();
      image.onload = () => {
        if (image.width > 4096 || image.height > 4096) {
          setStatus('Размер изображения не должен превышать 4096 × 4096');
          return;
        }
        setImportedImage(image);
        setCanvasWidth(image.width);
        setCanvasHeight(image.height);
        setStatus(`Загружено изображение ${image.width} × ${image.height}`);
      };
      image.onerror = () => setStatus('Файл не удалось открыть как изображение');
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const exportAsPNG = () => {
    const stage = stageRef.current;
    if (!stage) {
      setStatus('Холст ещё не готов');
      return;
    }
    const link = document.createElement('a');
    link.href = stage.toDataURL({ pixelRatio: 1 / zoom });
    link.download = `texture-${canvasWidth}x${canvasHeight}.png`;
    link.click();
    setStatus('Текстура сохранена в PNG');
  };

  const setPresetSize = (size: number) => {
    setCanvasWidth(size);
    setCanvasHeight(size);
    setImportedImage(null);
    setBackgroundColor(null);
    setStrokes([]);
    setRedoStrokes([]);
    setStatus(`Создан холст ${size} × ${size}`);
  };

  return (
    <TabLayout label={t('tabs.editor')} id={0} icon={<Palette size={18} />}>
      <div className="texture-workspace">
        <section className="texture-ribbon" aria-label="Панель инструментов">
          <div className="texture-ribbon-group texture-ribbon-tools">
            <span className="texture-ribbon-caption">Инструменты</span>
            <div className="texture-tool-buttons">
              {[
                { id: 'brush', label: 'Кисть', icon: <Palette size={17} /> },
                { id: 'eraser', label: 'Ластик', icon: <Eraser size={17} /> },
                { id: 'fill', label: 'Заливка', icon: <Plus size={17} /> },
                { id: 'eyedropper', label: 'Пипетка', icon: <Eye size={17} /> },
              ].map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  className={`texture-tool-button ${currentTool === tool.id ? 'is-selected' : ''}`}
                  onClick={() => setCurrentTool(tool.id)}
                  aria-pressed={currentTool === tool.id}
                  title={tool.label}
                >
                  {tool.icon}
                  <span>{tool.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="texture-ribbon-group texture-ribbon-brush">
            <span className="texture-ribbon-caption">Кисть</span>
            <label className="texture-ribbon-range">
              <span>Размер <b>{brushSize}px</b></span>
              <input type="range" min="1" max="64" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} aria-label="Размер кисти" />
            </label>
            <label className="texture-ribbon-range">
              <span>Жёсткость <b>{brushHardness}%</b></span>
              <input type="range" min="1" max="100" value={brushHardness} onChange={(event) => setBrushHardness(Number(event.target.value))} aria-label="Жёсткость кисти" />
            </label>
            <div className="texture-brush-shapes" aria-label="Форма кисти">
              {(['square', 'circle', 'diamond'] as const).map((shape) => (
                <button
                  key={shape}
                  type="button"
                  onClick={() => setBrushShape(shape)}
                  className={`texture-brush-shape ${brushShape === shape ? 'is-selected' : ''}`}
                  aria-label={shape === 'square' ? 'Квадратная кисть' : shape === 'circle' ? 'Круглая кисть' : 'Кисть ромб'}
                  aria-pressed={brushShape === shape}
                >
                  <i className={`texture-shape-preview shape-${shape}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="texture-ribbon-group texture-ribbon-colors">
            <span className="texture-ribbon-caption">Цвета</span>
            <div className="texture-color-palette">
              {[
                '#172014', '#ffffff', '#777777', '#c4c4c4',
                '#812e25', '#ea4b36', '#ef922e', '#f3d547',
                '#69ad3b', '#2c7135', '#44c5a0', '#3785d0',
                '#393d9b', '#914bc1', '#d96aa9', '#8a5a36',
              ].map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`texture-palette-swatch ${selectedColor.toLowerCase() === color ? 'is-selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                  title={color}
                  aria-label={`Выбрать цвет ${color}`}
                />
              ))}
              <label className="texture-custom-color" title="Другой цвет">
                <input type="color" value={selectedColor} onChange={(event) => setSelectedColor(event.target.value)} aria-label="Выбрать свой цвет" />
                <Palette size={15} />
              </label>
            </div>
            <span className="texture-current-color">{selectedColor.toUpperCase()}</span>
          </div>

          <div className="texture-ribbon-group texture-ribbon-document">
            <span className="texture-ribbon-caption">Холст</span>
            <div className="texture-size-options">
              {[16, 32, 64, 128, 256, 512].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPresetSize(size)}
                  className={`texture-size-button ${canvasWidth === size && canvasHeight === size ? 'is-selected' : ''}`}
                >
                  {size}
                </button>
              ))}
            </div>
            <label className="texture-ribbon-import">
              <Upload size={15} />
              <span>Импорт</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={importImage} />
            </label>
            <button type="button" className="texture-ribbon-export" onClick={exportAsPNG}>
              <Download size={15} />
              <span>Экспорт PNG</span>
            </button>
          </div>
        </section>

        <section className="texture-canvas-panel">
          <div className="texture-canvas-toolbar">
            <div>
              <strong>Холст</strong>
              <span>{canvasWidth} × {canvasHeight} px</span>
            </div>
            <div className="texture-toolbar-actions">
              <button type="button" onClick={undo} disabled={strokes.length === 0} title="Отменить" aria-label="Отменить"><Undo2 size={16} /></button>
              <button type="button" onClick={redo} disabled={redoStrokes.length === 0} title="Повторить" aria-label="Повторить"><Redo2 size={16} /></button>
              <button type="button" onClick={toggleGridVisible} className={gridVisible ? 'is-active' : ''} title="Сетка" aria-label="Переключить сетку"><Grid3x3 size={16} /></button>
            </div>
          </div>
          <div className="texture-canvas-area">
            <div className="texture-canvas-frame" style={{ width: stageWidth, height: stageHeight }}>
              <Stage
                ref={stageRef}
                width={stageWidth}
                height={stageHeight}
                onPointerDown={startDrawing}
                onPointerMove={continueDrawing}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
                className="texture-stage"
              >
                <KonvaLayer>
                  <Group scaleX={zoom} scaleY={zoom}>
                    {backgroundColor && <Rect width={canvasWidth} height={canvasHeight} fill={backgroundColor} />}
                    {importedImage && <KonvaImage image={importedImage} width={canvasWidth} height={canvasHeight} />}
                    {layers.map((layer) => (
                      <Group key={layer.id} visible={layer.visible} opacity={layer.opacity}>
                        {strokes.filter((stroke) => stroke.layerId === layer.id).map((stroke) => (
                          <Line
                            key={stroke.id}
                            points={stroke.points}
                            stroke={stroke.tool === 'eraser' ? '#000000' : stroke.color}
                            strokeWidth={stroke.width}
                            lineCap={stroke.cap}
                            lineJoin={stroke.cap === 'square' ? 'miter' : 'round'}
                            opacity={stroke.opacity}
                            globalCompositeOperation={stroke.tool === 'eraser' ? 'destination-out' : 'source-over'}
                          />
                        ))}
                      </Group>
                    ))}
                    {gridVisible && Array.from({ length: Math.floor(canvasWidth / 16) + 1 }, (_, index) => (
                      <React.Fragment key={`grid-${index}`}>
                        <Line points={[index * 16, 0, index * 16, canvasHeight]} stroke="#6b7280" strokeWidth={0.5} opacity={0.35} listening={false} />
                      </React.Fragment>
                    ))}
                    {gridVisible && Array.from({ length: Math.floor(canvasHeight / 16) + 1 }, (_, index) => (
                      <Line key={`grid-row-${index}`} points={[0, index * 16, canvasWidth, index * 16]} stroke="#6b7280" strokeWidth={0.5} opacity={0.35} listening={false} />
                    ))}
                  </Group>
                </KonvaLayer>
              </Stage>
            </div>
          </div>
          <div className="texture-canvas-footer">
            <span><i className="texture-status-dot" />{status}</span>
            <span>Инструмент: {currentTool === 'brush' ? 'кисть' : currentTool}</span>
          </div>
        </section>

        <aside className="texture-panel texture-layers">
          <div className="texture-panel-heading">
            <span className="texture-panel-icon"><Layers size={16} /></span>
            <div>
              <h3>Слои</h3>
              <p>{layers.length} в документе</p>
            </div>
            <button type="button" className="texture-icon-button" onClick={createLayer} title="Добавить слой" aria-label="Добавить слой"><Plus size={16} /></button>
          </div>
          <div className="texture-layer-list">
            {[...layers].reverse().map((layer) => (
              <div key={layer.id} className={`texture-layer-card ${activeLayerId === layer.id ? 'is-selected' : ''}`}>
                <button type="button" className="texture-layer-select" onClick={() => setActiveLayerId(layer.id)}>
                  <span className="texture-layer-thumb"><Layers size={15} /></span>
                  <span>{layer.name}</span>
                </button>
                <button
                  type="button"
                  className="texture-layer-visibility"
                  onClick={() => setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, visible: !item.visible } : item))}
                  title={layer.visible ? 'Скрыть слой' : 'Показать слой'}
                  aria-label={layer.visible ? 'Скрыть слой' : 'Показать слой'}
                >
                  {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <div className="texture-layer-actions">
                  <button type="button" onClick={() => duplicateLayer(layer.id)} title="Дублировать слой" aria-label="Дублировать слой"><Copy size={14} /></button>
                  <button type="button" onClick={() => deleteLayer(layer.id)} disabled={layers.length <= 1} title="Удалить слой" aria-label="Удалить слой"><Trash2 size={14} /></button>
                </div>
                {activeLayerId === layer.id && (
                  <label className="texture-layer-opacity">
                    <Minus size={12} />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={layer.opacity}
                      onChange={(event) => setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, opacity: Number(event.target.value) } : item))}
                      aria-label="Непрозрачность слоя"
                    />
                    <Plus size={12} />
                  </label>
                )}
              </div>
            ))}
          </div>
          <p className="texture-hint"><Eraser size={14} /> PNG сохраняется с прозрачностью</p>
        </aside>
      </div>
    </TabLayout>
  );
};
