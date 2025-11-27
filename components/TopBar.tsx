
import React from 'react';
import { User, BrainCircuit } from 'lucide-react';

export const TopBar: React.FC = () => {
  return (
    <div className="sticky top-0 z-40 bg-indigo-950 text-white shadow-md px-3 h-10 flex items-center justify-between transition-colors duration-300">
      
      {/* App Logo & Name */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-indigo-500 rounded-md flex items-center justify-center text-white shadow-sm">
          <BrainCircuit size={14} />
        </div>
        <div>
          <h1 className="text-sm font-bold leading-none tracking-tight">الذاكرة الذكية</h1>
        </div>
      </div>

      {/* User Avatar */}
      <div className="relative group cursor-pointer">
        <div className="w-7 h-7 rounded-full bg-indigo-800 border border-indigo-700 flex items-center justify-center overflow-hidden">
             <User size={14} className="text-indigo-200" />
        </div>
        <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border border-indigo-950 rounded-full"></div>
      </div>
    </div>
  );
};
