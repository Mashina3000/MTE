import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  ImagePlus,
  Lightbulb,
  RefreshCw,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { TabLayout } from '@/components/TabLayout';

type TextureStyle = 'шахматка' | 'полосы' | 'кристалл' | 'точки';

const PALETTES = {
  Лесная: ['#183b2d', '#2d6b45', '#71a85b', '#b7d78a'],
  Океан: ['#12334b', '#176b87', '#36a6a3', '#a1ded0'],
  Закат: ['#572b42', '#a74449', '#e37b4e', '#f5c16b'],
  Аметист: ['#32244f', '#654b91', '#a17bc1', '#e0bce0'],
} as const;

type PaletteName = keyof typeof PALETTES;

const textureTips = [
  'Ограничьте палитру 3–5 оттенками: так пиксельная текстура будет читаться чище.',
  'Проверьте текстуру на масштабе 100% и в игровом окружении — мелкие детали могут потеряться.',
  'Используйте светлые оттенки для верхних граней, а тёмные — для углублений и теней.',
  'Повторяющийся узор лучше оценивать плиткой 3×3: так заметны швы и слишком частые детали.',
];

function drawTexture(
  canvas: HTMLCanvasElement,
  size: number,
  palette: readonly string[],
  style: TextureStyle,
  seed: number,
) {
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Браузер не предоставил 2D-контекст canvas.');

  const cell = Math.max(1, Math.floor(size / 8));
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const column = Math.floor(x / cell);
      const row = Math.floor(y / cell);
      const wave = (column * 3 + row * 5 + seed) % palette.length;
      let colorIndex = wave;
      if (style === 'шахматка') colorIndex = (column + row + seed) % 2 === 0 ? 1 : 3;
      if (style === 'полосы') colorIndex = (column + seed) % palette.length;
      if (style === 'кристалл') colorIndex = (Math.abs(column - row) + seed + row) % palette.length;
      if (style === 'точки') {
        colorIndex = (column * 7 + row * 11 + seed) % 5 === 0 ? palette.length - 1 : 1;
      }
      context.fillStyle = palette[colorIndex % palette.length];
      context.fillRect(x, y, cell, cell);
    }
  }
}

export const AIAssistantTab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(32);
  const [paletteName, setPaletteName] = useState<PaletteName>('Лесная');
  const [style, setStyle] = useState<TextureStyle>('шахматка');
  const [seed, setSeed] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || imageUrl) return;
    try {
      drawTexture(canvas, size, PALETTES[paletteName], style, seed);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось создать текстуру.');
    }
  }, [imageUrl, paletteName, seed, size, style]);

  useEffect(() => {
    if (!imageUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = new Image();
    image.onload = () => {
      const context = canvas.getContext('2d');
      if (!context) {
        setMessage('Браузер не предоставил 2D-контекст canvas.');
        return;
      }
      canvas.width = size;
      canvas.height = size;
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      setMessage('Изображение уменьшено до размера пиксельной текстуры.');
    };
    image.onerror = () => setMessage('Не удалось прочитать выбранное изображение.');
    image.src = imageUrl;
  }, [imageUrl, size]);

  const handleImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Выберите файл изображения.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setMessage('Не удалось загрузить изображение.');
        return;
      }
      setImageUrl(reader.result);
      setMessage(`Загружено локально: ${file.name}`);
    };
    reader.onerror = () => setMessage('Ошибка чтения файла изображения.');
    reader.readAsDataURL(file);
  };

  const downloadTexture = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          setMessage('Не удалось подготовить PNG-файл.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `minecraft-texture-${size}x${size}.png`;
        anchor.click();
        URL.revokeObjectURL(url);
        setMessage('PNG сохранён через загрузки браузера.');
      }, 'image/png');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить PNG.');
    }
  };

  return (
    <TabLayout id={8} label="ИИ-ассистент" icon={<Sparkles className="h-5 w-5" />}>
      <div className="mx-auto grid max-w-6xl gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-gray-700 bg-gray-900 p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Локальная мастерская текстур</h3>
              <p className="mt-1 text-sm text-gray-400">
                Детерминированные пиксельные узоры создаются в браузере. Запросы и файлы никуда не отправляются.
              </p>
            </div>
            <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-300">
              Только на этом устройстве
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="flex min-h-72 items-center justify-center overflow-auto rounded-lg bg-gray-950 p-6">
              <canvas
                ref={canvasRef}
                aria-label="Предпросмотр пиксельной текстуры"
                className="h-64 w-64 border border-gray-600 shadow-lg [image-rendering:pixelated]"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <div className="space-y-4">
              <label className="block text-sm text-gray-300">
                Размер
                <select
                  value={size}
                  onChange={(event) => setSize(Number(event.target.value))}
                  className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white"
                >
                  {[16, 32, 64, 128].map((value) => (
                    <option key={value} value={value}>{value} × {value} px</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-gray-300">
                Палитра
                <select
                  value={paletteName}
                  onChange={(event) => setPaletteName(event.target.value as PaletteName)}
                  className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white"
                >
                  {Object.keys(PALETTES).map((name) => <option key={name}>{name}</option>)}
                </select>
              </label>
              <label className="block text-sm text-gray-300">
                Стиль
                <select
                  value={style}
                  onChange={(event) => setStyle(event.target.value as TextureStyle)}
                  className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white"
                >
                  {(['шахматка', 'полосы', 'кристалл', 'точки'] as TextureStyle[]).map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => { setImageUrl(null); setSeed((value) => value + 1); setMessage('Создан новый вариант узора.'); }}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                <WandSparkles className="h-4 w-4" /> Новый вариант
              </button>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800">
                <ImagePlus className="h-4 w-4" /> Уменьшить своё изображение
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => handleImage(event.target.files?.[0])}
                />
              </label>
              {imageUrl && (
                <button type="button" onClick={() => { setImageUrl(null); setMessage('Возвращён генератор узоров.'); }} className="w-full text-xs text-indigo-300 hover:text-indigo-200">
                  Вернуться к генерации узора
                </button>
              )}
              <button
                type="button"
                onClick={downloadTexture}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                <Download className="h-4 w-4" /> Скачать PNG
              </button>
            </div>
          </div>
          {message && <p role="status" className="mt-4 text-sm text-gray-300">{message}</p>}
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-gray-700 bg-gray-900 p-5">
            <h3 className="flex items-center gap-2 font-semibold text-white">
              <Lightbulb className="h-5 w-5 text-amber-300" /> Советы по текстурам
            </h3>
            <p className="mt-3 min-h-20 text-sm leading-6 text-gray-300">{textureTips[tipIndex]}</p>
            <button
              type="button"
              onClick={() => setTipIndex((value) => (value + 1) % textureTips.length)}
              className="mt-3 flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200"
            >
              <RefreshCw className="h-4 w-4" /> Другой совет
            </button>
          </section>
          <section className="rounded-xl border border-gray-700 bg-gray-900 p-5 text-sm leading-6 text-gray-400">
            <h3 className="mb-2 font-semibold text-white">О локальном режиме</h3>
            <p>Генерация узора и уменьшение выбранного изображения выполняются в браузере. Здесь нет облачной модели или сетевого ИИ.</p>
          </section>
        </aside>
      </div>
    </TabLayout>
  );
};
