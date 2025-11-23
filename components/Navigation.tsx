import React from 'react';
import { Mic, LayoutGrid, Sparkles } from 'lucide-react';

interface NavigationProps {
  activeTab: 'capture' | 'memories' | 'search';
  setActiveTab: (tab: 'capture' | 'memories' | 'search') => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-white/10 pb-6 pt-3 px-6 z-50">
      <div className="flex justify-around items-center max-w-md mx-auto">
        <button 
          onClick={() => setActiveTab('memories')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'memories' ? 'text-primary' : 'text-gray-400'}`}
        >
          <LayoutGrid size={24} />
          <span className="text-xs font-medium">ذكرياتي</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('capture')}
          className={`flex flex-col items-center justify-center -mt-6 bg-primary text-white rounded-full w-14 h-14 shadow-lg shadow-primary/40 border-4 border-dark transition-transform active:scale-95 ${activeTab === 'capture' ? 'scale-110' : ''}`}
        >
          <Mic size={28} />
        </button>
        
        <button 
          onClick={() => setActiveTab('search')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'search' ? 'text-secondary' : 'text-gray-400'}`}
        >
          <Sparkles size={24} />
          <span className="text-xs font-medium">بحث ذكي</span>
        </button>
      </div>
    </nav>
  );
};
