import React from 'react';
import { TabLayout } from '@/components/TabLayout';
import { AlertCircle } from 'lucide-react';

const ComingSoonTab: React.FC<{
  id: number;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = ({ id, label, description, icon }) => {
  return (
    <TabLayout label={label} id={id} icon={icon}>
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold text-gray-200 mb-2">{label}</h2>
          <p className="text-gray-400 mb-4">{description}</p>
          <div className="inline-block px-4 py-2 bg-yellow-600 text-white rounded font-semibold">
            В разработке
          </div>
        </div>
      </div>
    </TabLayout>
  );
};

// Tab 4 - 3D Preview
export const Preview3DTab: React.FC = () => (
  <ComingSoonTab
    id={3}
    label="3D Preview"
    icon={<>📦</>}
    description="Трёхмерный предпросмотр блоков, предметов и персонажей"
  />
);
