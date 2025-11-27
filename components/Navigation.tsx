
import React from 'react';
import { Mic, LayoutGrid, Sparkles, Settings, CalendarDays, WifiOff } from 'lucide-react';

interface NavigationProps {
  activeTab: 'capture' | 'memories' | 'search' | 'settings' | 'schedule';
  setActiveTab: (tab: 'capture' | 'memories' | 'search' | 'settings' | 'schedule') => void;
  isOnline?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab, isOnline = true }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200 dark:border-white/5 z-50 transition-colors duration-300 h-12 shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
      
      {!isOnline && (
        <div className="absolute -top-5 left-0 right-0 bg-red-500 text-white text-[9px] py-0.5 text-center font-bold flex items-center justify-center gap-2">
            <WifiOff size={10} />
            <span>غير متصل</span>
        </div>
      )}

      <div className="flex justify-between items-center max-w-md mx-auto px-6 h-full">
        
        <button 
          onClick={() => setActiveTab('memories')}
          title="ذكرياتي"
          className={`flex items-center justify-center w-10 h-full transition-all ${activeTab === 'memories' ? 'text-primary' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <LayoutGrid size={22} strokeWidth={activeTab === 'memories' ? 2.5 : 2} />
        </button>

        <button 
          onClick={() => setActiveTab('schedule')}
          title="مواعيدي"
          className={`flex items-center justify-center w-10 h-full transition-all ${activeTab === 'schedule' ? 'text-green-500' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <CalendarDays size={22} strokeWidth={activeTab === 'schedule' ? 2.5 : 2} />
        </button>

        {/* Main Action Button - Lifted slightly less */}
        <div className="relative -top-4">
            <button 
            onClick={() => setActiveTab('capture')}
            title="تسجيل جديد"
            className={`flex items-center justify-center bg-gradient-to-br from-primary to-secondary text-white rounded-full w-12 h-12 shadow-lg shadow-primary/30 border-2 border-white dark:border-slate-900 transition-transform active:scale-95 ${activeTab === 'capture' ? 'scale-110 ring-2 ring-primary/30' : ''}`}
            >
            <Mic size={22} />
            </button>
        </div>
        
        <button 
          onClick={() => setActiveTab('search')}
          title="البحث الذكي"
          className={`flex items-center justify-center w-10 h-full transition-all ${activeTab === 'search' ? 'text-secondary' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <Sparkles size={22} strokeWidth={activeTab === 'search' ? 2.5 : 2} />
        </button>

        <button 
          onClick={() => setActiveTab('settings')}
          title="الإعدادات"
          className={`flex items-center justify-center w-10 h-full transition-all ${activeTab === 'settings' ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <Settings size={22} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
        </button>
      </div>
    </nav>
  );
};
