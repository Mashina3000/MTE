import React from 'react';

export interface TabProps {
  id: number;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  children: React.ReactNode;
}

export const TabLayout: React.FC<TabProps> = ({ label, children }) => {
  return (
    <div className="flex flex-col w-full h-full bg-gray-800">
      <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">{label}</h2>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {children}
      </div>
    </div>
  );
};
