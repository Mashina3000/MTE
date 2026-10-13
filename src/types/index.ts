// Типы для редактора
export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Brush {
  id: number;
  name: string;
  shape: 'square' | 'circle' | 'diamond';
  size: number;
  hardness: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: string;
  data: ImageData;
}

export interface Canvas {
  width: number;
  height: number;
  layers: Layer[];
  currentLayerIndex: number;
}

// Типы для анимации
export interface AnimationFrame {
  duration: number;
  imageData: ImageData;
}

export interface Animation {
  frames: AnimationFrame[];
  fps: number;
  interpolate: boolean;
  loop: 'loop' | 'once' | 'ping_pong';
}

// Типы для ресурс-пака
export interface MinecraftVersion {
  id: string;
  name: string;
  type: 'release' | 'snapshot' | 'alpha' | 'beta';
  releaseDate: string;
  packFormat: number;
}

export interface ResourcePack {
  name: string;
  description: string;
  version: string;
  author: string;
  packFormat: number;
  minecraftVersions: MinecraftVersion[];
  thumbnail?: string;
}

// Типы для 3D превью
export interface Model3D {
  id: string;
  name: string;
  url: string;
  type: 'block' | 'item' | 'entity' | 'armor' | 'custom';
}

export interface Light {
  type: 'ambient' | 'directional' | 'point' | 'spot';
  intensity: number;
  color: [number, number, number];
  position?: [number, number, number];
}

// Типы для файлов
export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  modified?: Date;
  preview?: string;
}

// Типы для настроек
export interface Settings {
  theme: 'dark' | 'light' | 'auto';
  language: string;
  fontSize: number;
  uiScale: number;
  autosave: boolean;
  autosaveInterval: number;
}
