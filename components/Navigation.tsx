
import React from 'react';
import { Mic, LayoutGrid, Sparkles, Settings, CalendarDays } from 'lucide-react';

interface NavigationProps {
  activeTab: 'capture' | 'memories' | 'search' | 'settings' | 'schedule';
  setActiveTab: (tab: 'capture' | 'memories' | 'search' | 'settings' | 'schedule') => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-white/10 pb-6 pt-3 px-2 z-50 transition-colors duration-300">
      <div className="flex justify-between items-end max-w-md mx-auto px-4">
        
        <button 
          onClick={() => setActiveTab('memories')}
          className={`flex flex-col items-center gap-1 transition-colors w-12 ${activeTab === 'memories' ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}
        >
          <LayoutGrid size={22} strokeWidth={activeTab === 'memories' ? 2.5 : 2} />
          <span className="text-[9px] font-medium">ذكرياتي</span>
        </button>

        <button 
          onClick={() => setActiveTab('schedule')}
          className={`flex flex-col items-center gap-1 transition-colors w-12 ${activeTab === 'schedule' ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}`}
        >
          <CalendarDays size={22} strokeWidth={activeTab === 'schedule' ? 2.5 : 2} />
          <span className="text-[9px] font-medium">مواعيدي</span>
        </button>

        {/* Main Action Button - Lifted */}
        <div className="relative -top-5">
            <button 
            onClick={() => setActiveTab('capture')}
            className={`flex flex-col items-center justify-center bg-gradient-to-br from-primary to-secondary text-white rounded-full w-14 h-14 shadow-lg shadow-primary/30 border-4 border-white dark:border-slate-900 transition-transform active:scale-95 ${activeTab === 'capture' ? 'scale-110 ring-2 ring-primary/30' : ''}`}
            >
            <Mic size={28} />
            </button>
        </div>
        
        <button 
          onClick={() => setActiveTab('search')}
          className={`flex flex-col items-center gap-1 transition-colors w-12 ${activeTab === 'search' ? 'text-secondary' : 'text-gray-400 dark:text-gray-500'}`}
        >
          <Sparkles size={22} strokeWidth={activeTab === 'search' ? 2.5 : 2} />
          <span className="text-[9px] font-medium">بحث</span>
        </button>

        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 transition-colors w-12 ${activeTab === 'settings' ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`}
        >
          <Settings size={22} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
          <span className="text-[9px] font-medium">إعدادات</span>
        </button>
      </div>
    </nav>
  );
};
