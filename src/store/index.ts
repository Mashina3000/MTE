import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// Типы для состояния
export interface EditorState {
  currentTool: string;
  brushSize: number;
  brushShape: 'square' | 'circle' | 'diamond';
  brushHardness: number;
  isSymmetryX: boolean;
  isSymmetryY: boolean;
  gridVisible: boolean;
  setCurrentTool: (tool: string) => void;
  setBrushSize: (size: number) => void;
  setBrushShape: (shape: 'square' | 'circle' | 'diamond') => void;
  setBrushHardness: (hardness: number) => void;
  toggleSymmetryX: () => void;
  toggleSymmetryY: () => void;
  toggleGridVisible: () => void;
}

export interface AnimationState {
  fps: number;
  currentFrameIndex: number;
  isPlaying: boolean;
  frameCount: number;
  setFps: (fps: number) => void;
  setCurrentFrameIndex: (index: number) => void;
  togglePlaying: () => void;
  setFrameCount: (count: number) => void;
}

export interface ResourcePackState {
  packName: string;
  packFormat: number;
  selectedVersions: string[];
  setPackName: (name: string) => void;
  setPackFormat: (format: number) => void;
  setSelectedVersions: (versions: string[]) => void;
}

export interface UIState {
  activeTab: number;
  isDraggingTab: boolean;
  theme: 'dark' | 'light' | 'auto';
  sidebarWidth: number;
  language: string;
  setActiveTab: (tab: number) => void;
  setIsDraggingTab: (isDragging: boolean) => void;
  setTheme: (theme: 'dark' | 'light' | 'auto') => void;
  setSidebarWidth: (width: number) => void;
  setLanguage: (lang: string) => void;
}

// Создать слайсы
const createEditorSlice = (set: any) => ({
  currentTool: 'brush',
  brushSize: 10,
  brushShape: 'circle' as const,
  brushHardness: 100,
  isSymmetryX: false,
  isSymmetryY: false,
  gridVisible: false,
  setCurrentTool: (tool: string) => set({ currentTool: tool }),
  setBrushSize: (size: number) => set({ brushSize: size }),
  setBrushShape: (shape: 'square' | 'circle' | 'diamond') => set({ brushShape: shape }),
  setBrushHardness: (hardness: number) => set({ brushHardness: hardness }),
  toggleSymmetryX: () => set((state: any) => ({ isSymmetryX: !state.isSymmetryX })),
  toggleSymmetryY: () => set((state: any) => ({ isSymmetryY: !state.isSymmetryY })),
  toggleGridVisible: () => set((state: any) => ({ gridVisible: !state.gridVisible })),
});

const createAnimationSlice = (set: any) => ({
  fps: 10,
  currentFrameIndex: 0,
  isPlaying: false,
  frameCount: 1,
  setFps: (fps: number) => set({ fps }),
  setCurrentFrameIndex: (index: number) => set({ currentFrameIndex: index }),
  togglePlaying: () => set((state: any) => ({ isPlaying: !state.isPlaying })),
  setFrameCount: (count: number) => set({ frameCount: count }),
});

const createResourcePackSlice = (set: any) => ({
  packName: 'My Resource Pack',
  packFormat: 15,
  selectedVersions: ['1.20.1'],
  setPackName: (name: string) => set({ packName: name }),
  setPackFormat: (format: number) => set({ packFormat: format }),
  setSelectedVersions: (versions: string[]) => set({ selectedVersions: versions }),
});

const createUISlice = (set: any) => ({
  activeTab: 0,
  isDraggingTab: false,
  theme: 'dark' as const,
  sidebarWidth: 280,
  language: 'ru',
  setActiveTab: (tab: number) => set({ activeTab: tab }),
  setIsDraggingTab: (isDragging: boolean) => set({ isDraggingTab: isDragging }),
  setTheme: (theme: 'dark' | 'light' | 'auto') => set({ theme }),
  setSidebarWidth: (width: number) => set({ sidebarWidth: width }),
  setLanguage: (lang: string) => set({ language: lang }),
});

// Объединить слайсы
export const useStore = create<
  EditorState & AnimationState & ResourcePackState & UIState
>(
  devtools(
    persist(
      (set) => ({
        ...createEditorSlice(set),
        ...createAnimationSlice(set),
        ...createResourcePackSlice(set),
        ...createUISlice(set),
      }),
      {
        name: 'minecraft-editor-store',
      }
    )
  )
);
