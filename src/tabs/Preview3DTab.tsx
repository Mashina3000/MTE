import React, { useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Float, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { TabLayout } from '@/components/TabLayout';
import { Cube, Camera, Sparkles, Download, RotateCcw } from 'lucide-react';

type CameraPreset =
  | 'front'
  | 'side'
  | 'top'
  | 'iso'
  | 'first-person'
  | 'third-person'
  | 'inventory'
  | 'drop';

type ModelType = 'block' | 'item' | 'mob' | 'skin' | 'armor' | 'tool';
type PoseName = 'standing' | 'walking' | 'running' | 'sitting' | 'floating' | 'riding';
type LightingPreset = 'day' | 'night' | 'nether' | 'end' | 'cave' | 'underwater' | 'space';

type ContextOption = {
  id: string;
  label: string;
  description: string;
};

const CONTEXTS: ContextOption[] = [
  { id: 'front', label: 'Front', description: 'Вид спереди' },
  { id: 'side', label: 'Side', description: 'Вид сбоку' },
  { id: 'top', label: 'Top', description: 'Вид сверху' },
  { id: 'iso', label: 'Isometric', description: 'Изометрия' },
  { id: 'first-person', label: 'First Person', description: 'От первого лица' },
  { id: 'third-person', label: 'Third Person', description: 'От третьего лица' },
  { id: 'inventory', label: 'Inventory', description: 'Инвентарь 16x16' },
  { id: 'drop', label: 'Drop', description: 'Выпавший предмет' },
  { id: 'helmet', label: 'Helmet', description: 'На голове' },
  { id: 'chest', label: 'Chest', description: 'На груди' },
  { id: 'leggings', label: 'Leggings', description: 'На ногах' },
  { id: 'boots', label: 'Boots', description: 'На ступнях' },
  { id: 'elytra', label: 'Elytra', description: 'На спине' },
  { id: 'block-world', label: 'World Block', description: 'Блок в мире' },
  { id: 'block-floor', label: 'Floor Block', description: 'Блок у пола' },
  { id: 'hotbar', label: 'Hotbar', description: 'Хотбар' },
];

const CAMERA_PRESETS: Record<CameraPreset, { position: [number, number, number]; target: [number, number, number] }> = {
  front: { position: [0, 0.6, 5], target: [0, 0.5, 0] },
  side: { position: [5, 0.6, 0], target: [0, 0.5, 0] },
  top: { position: [0, 5, 0.1], target: [0, 0, 0] },
  iso: { position: [4.5, 3.2, 4.5], target: [0, 0.6, 0] },
  'first-person': { position: [0, 1.4, 1.8], target: [0, 1.2, 0] },
  'third-person': { position: [3.5, 1.8, 3.5], target: [0, 1, 0] },
  inventory: { position: [0, 0.1, 4.5], target: [0, 0.1, 0] },
  drop: { position: [0, 1.8, 5], target: [0, 0.6, 0] },
};

const LIGHTING_PRESETS: Record<LightingPreset, { ambient: number; directional: number; color: string }> = {
  day: { ambient: 1.25, directional: 1.5, color: '#fff5d6' },
  night: { ambient: 0.5, directional: 1.1, color: '#8aa0ff' },
  nether: { ambient: 0.9, directional: 1.3, color: '#ff8a50' },
  end: { ambient: 0.85, directional: 1.1, color: '#d2b8ff' },
  cave: { ambient: 0.7, directional: 0.8, color: '#9db8c4' },
  underwater: { ambient: 0.9, directional: 0.9, color: '#7edffc' },
  space: { ambient: 0.5, directional: 1.1, color: '#dfe9ff' },
};

const MODEL_TYPES: ModelType[] = ['block', 'item', 'mob', 'skin', 'armor', 'tool'];
const POSES: PoseName[] = ['standing', 'walking', 'running', 'sitting', 'floating', 'riding'];

function CameraRig({ preset }: { preset: CameraPreset }) {
  const { camera } = useThree();

  useFrame(() => {
    const config = CAMERA_PRESETS[preset];
    camera.position.lerp(new THREE.Vector3(...config.position), 0.06);
    camera.lookAt(config.target[0], config.target[1], config.target[2]);
  });

  return null;
}

function PreviewModel({ modelType, pose, skinTone }: { modelType: ModelType; pose: PoseName; skinTone: string }) {
  const rotationY = useMemo(() => {
    switch (pose) {
      case 'walking':
        return Math.PI / 7;
      case 'running':
        return Math.PI / 4;
      case 'sitting':
        return Math.PI / 12;
      case 'floating':
        return Math.PI / 2;
      case 'riding':
        return -Math.PI / 6;
      default:
        return 0;
    }
  }, [pose]);

  const itemColor = useMemo(() => {
    switch (modelType) {
      case 'block':
        return '#7cc7ff';
      case 'item':
        return '#ffe767';
      case 'mob':
        return '#8ad98a';
      case 'skin':
        return skinTone;
      case 'armor':
        return '#8fb4ff';
      case 'tool':
        return '#f4b580';
      default:
        return '#ffffff';
    }
  }, [modelType, skinTone]);

  return (
    <group rotation={[0.2, rotationY, 0]} position={[0, 0.4, 0]}>
      {modelType === 'block' && (
        <>
          <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color={itemColor} metalness={0.2} roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0, 2.1, 0]}>
            <boxGeometry args={[1.8, 0.35, 1.8]} />
            <meshStandardMaterial color="#d9f4ff" roughness={0.6} />
          </mesh>
        </>
      )}

      {modelType === 'item' && (
        <>
          <mesh castShadow receiveShadow position={[0, 0.9, 0]} rotation={[0.8, 0, 0.2]}>
            <boxGeometry args={[1.3, 1.3, 1.3]} />
            <meshStandardMaterial color={itemColor} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh castShadow position={[0, 1.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.7, 0.12, 12, 40]} />
            <meshStandardMaterial color="#fff2b3" metalness={0.8} roughness={0.2} />
          </mesh>
        </>
      )}

      {modelType === 'tool' && (
        <>
          <mesh castShadow position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.12, 2.6, 12]} />
            <meshStandardMaterial color={itemColor} metalness={0.7} roughness={0.25} />
          </mesh>
          <mesh castShadow position={[0.6, 1.6, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.55, 0.2, 0.55]} />
            <meshStandardMaterial color="#c2d6ff" roughness={0.5} />
          </mesh>
        </>
      )}

      {modelType === 'armor' && (
        <group position={[0, 0.3, 0]}>
          <mesh castShadow position={[0, 1.15, 0]}>
            <boxGeometry args={[1.2, 1.4, 0.7]} />
            <meshStandardMaterial color={itemColor} metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh castShadow position={[-0.38, 0.3, 0]}>
            <boxGeometry args={[0.4, 1.2, 0.5]} />
            <meshStandardMaterial color={itemColor} roughness={0.45} />
          </mesh>
          <mesh castShadow position={[0.38, 0.3, 0]}>
            <boxGeometry args={[0.4, 1.2, 0.5]} />
            <meshStandardMaterial color={itemColor} roughness={0.45} />
          </mesh>
        </group>
      )}

      {modelType === 'mob' && (
        <group position={[0, 0.2, 0]}>
          <mesh castShadow position={[0, 1.3, 0]}>
            <boxGeometry args={[1.3, 1.6, 0.9]} />
            <meshStandardMaterial color={itemColor} roughness={0.7} />
          </mesh>
          <mesh castShadow position={[0, 2.6, 0.1]}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial color={skinTone} roughness={0.9} />
          </mesh>
        </group>
      )}

      {modelType === 'skin' && (
        <group position={[0, 0.2, 0]}>
          <mesh castShadow position={[0, 1.5, 0]}>
            <boxGeometry args={[1.1, 1.9, 0.6]} />
            <meshStandardMaterial color={skinTone} roughness={0.85} />
          </mesh>
          <mesh castShadow position={[0, 2.6, 0.1]}>
            <sphereGeometry args={[0.38, 16, 16]} />
            <meshStandardMaterial color={skinTone} roughness={0.9} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function Scene({
  preset,
  modelType,
  pose,
  lighting,
  environment,
  fov,
  rotation,
  skinTone,
}: {
  preset: CameraPreset;
  modelType: ModelType;
  pose: PoseName;
  lighting: LightingPreset;
  environment: 'solid' | 'gradient' | 'hdr' | 'image';
  fov: number;
  rotation: number;
  skinTone: string;
}) {
  const lightConfig = LIGHTING_PRESETS[lighting];

  return (
    <>
      <color attach="background" args={[environment === 'solid' ? '#111827' : '#0b1020']} />
      <fog attach="fog" args={[environment === 'solid' ? '#111827' : '#0b1020', 4, 16]} />

      <ambientLight intensity={lightConfig.ambient} color={lightConfig.color} />
      <directionalLight
        castShadow
        position={[3.5, 5, 3.5]}
        intensity={lightConfig.directional}
        color={lightConfig.color}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[-3, 2, -2]} intensity={0.8} color="#92c5ff" />

      <CameraRig preset={preset} />
      <OrbitControls enablePan enableZoom enableRotate minDistance={2} maxDistance={12} />

      <Float speed={1.4} rotationIntensity={0.8} floatIntensity={0.6}>
        <group rotation={[0, rotation, 0]}>
          <PreviewModel modelType={modelType} pose={pose} skinTone={skinTone} />
        </group>
      </Float>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.4, 0]} receiveShadow>
        <circleGeometry args={[4.6, 64]} />
        <meshStandardMaterial color="#1f2937" roughness={0.9} metalness={0.2} />
      </mesh>

      <ContactShadows position={[0, -1.25, 0]} opacity={0.55} scale={8} blur={2.5} far={3.5} />
      {environment === 'gradient' && (
        <group position={[0, 0, -4]}>
          <mesh>
            <planeGeometry args={[30, 20]} />
            <meshBasicMaterial color="#0f172a" side={THREE.BackSide} />
          </mesh>
        </group>
      )}
      {environment === 'hdr' && <Environment preset="city" />}
      {environment === 'image' && (
        <mesh position={[0, 0, -6]}>
          <planeGeometry args={[18, 10]} />
          <meshBasicMaterial color="#1d4ed8" />
        </mesh>
      )}
    </>
  );
}

export const Preview3DTab: React.FC = () => {
  const [selectedContext, setSelectedContext] = useState<CameraPreset>('iso');
  const [modelType, setModelType] = useState<ModelType>('block');
  const [pose, setPose] = useState<PoseName>('standing');
  const [lighting, setLighting] = useState<LightingPreset>('day');
  const [environment, setEnvironment] = useState<'solid' | 'gradient' | 'hdr' | 'image'>('solid');
  const [fov, setFov] = useState(42);
  const [rotation, setRotation] = useState(0.4);
  const [skinTone, setSkinTone] = useState('#d8b28c');

  const contextLabel = CONTEXTS.find((ctx) => ctx.id === selectedContext)?.label ?? 'Isometric';

  const exportPreview = () => {
    const blob = new Blob([`Minecraft preview export\nContext: ${contextLabel}\nModel: ${modelType}\nPose: ${pose}`], {
      type: 'text/plain;charset=utf-8',
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `preview-${selectedContext}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  return (
    <TabLayout label="3D Preview" id={3} icon={<Cube />}>
      <div className="flex h-full gap-4">
        <aside className="w-72 bg-gray-900 rounded border border-gray-700 p-3 overflow-y-auto">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-200">
            <Camera size={16} />
            Contexts
          </div>
          <div className="space-y-2">
            {CONTEXTS.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedContext(item.id as CameraPreset)}
                className={`w-full text-left rounded border p-2 transition ${
                  selectedContext === item.id
                    ? 'border-blue-500 bg-blue-600/20'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="text-sm font-semibold text-gray-100">{item.label}</div>
                <div className="text-xs text-gray-400">{item.description}</div>
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1 flex flex-col gap-4">
          <div className="flex items-center justify-between rounded border border-gray-700 bg-gray-900 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-200">
              <Sparkles size={16} className="text-blue-400" />
              Camera: {contextLabel}
            </div>
            <div className="flex gap-2">
              {(['front', 'side', 'top', 'iso', 'first-person', 'third-person'] as CameraPreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setSelectedContext(preset)}
                  className={`rounded px-2 py-1 text-xs font-semibold ${
                    selectedContext === preset
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {preset.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-hidden rounded border border-gray-700 bg-black">
            <Canvas
              shadows
              camera={{ position: CAMERA_PRESETS[selectedContext].position, fov }}
              gl={{ antialias: true }}
            >
              <Scene
                preset={selectedContext}
                modelType={modelType}
                pose={pose}
                lighting={lighting}
                environment={environment}
                fov={fov}
                rotation={rotation}
                skinTone={skinTone}
              />
            </Canvas>
          </div>
        </div>

        <aside className="w-80 bg-gray-900 rounded border border-gray-700 p-3 space-y-4 overflow-y-auto">
          <div className="text-sm font-semibold text-gray-200">Model</div>
          <div className="grid grid-cols-2 gap-2">
            {MODEL_TYPES.map((item) => (
              <button
                key={item}
                onClick={() => setModelType(item)}
                className={`rounded px-2 py-2 text-xs font-semibold capitalize ${
                  modelType === item ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="text-sm font-semibold text-gray-200">Pose</div>
          <div className="grid grid-cols-2 gap-2">
            {POSES.map((item) => (
              <button
                key={item}
                onClick={() => setPose(item)}
                className={`rounded px-2 py-2 text-xs font-semibold capitalize ${
                  pose === item ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-200">FOV: {fov}</label>
            <input
              type="range"
              min={20}
              max={100}
              value={fov}
              onChange={(e) => setFov(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-200">Rotation: {rotation.toFixed(2)}</label>
            <input
              type="range"
              min={-Math.PI}
              max={Math.PI}
              step={0.01}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-200">Lighting</label>
            <select
              value={lighting}
              onChange={(e) => setLighting(e.target.value as LightingPreset)}
              className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
            >
              {Object.keys(LIGHTING_PRESETS).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-200">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as 'solid' | 'gradient' | 'hdr' | 'image')}
              className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
            >
              <option value="solid">Solid</option>
              <option value="gradient">Gradient</option>
              <option value="hdr">HDRI</option>
              <option value="image">Image</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-200">Skin tone</label>
            <input
              type="color"
              value={skinTone}
              onChange={(e) => setSkinTone(e.target.value)}
              className="h-10 w-full rounded border border-gray-700 bg-transparent"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setRotation(0.4)}
              className="flex flex-1 items-center justify-center gap-2 rounded bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-700"
            >
              <RotateCcw size={14} />
              Reset
            </button>
            <button
              onClick={exportPreview}
              className="flex flex-1 items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        </aside>
      </div>
    </TabLayout>
  );
};

export default Preview3DTab;
