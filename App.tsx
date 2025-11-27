
import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { CaptureView } from './components/CaptureView';
import { MemoriesView } from './components/MemoriesView';
import { SearchView } from './components/SearchView';
import { SettingsView } from './components/SettingsView';
import { ScheduleView } from './components/ScheduleView';
import { reminderService } from './services/reminderService';
import { getSettings, applyTheme } from './services/settingsService';

function App() {
  const [activeTab, setActiveTab] = useState<'capture' | 'memories' | 'search' | 'settings' | 'schedule'>('capture');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    // Init Reminder Service
    reminderService.init();

    // Apply User Theme Preference
    const settings = getSettings();
    applyTheme(settings.theme);
    
    return () => {
      reminderService.stop();
    };
  }, []);

  const handleJumpToMemory = (id: string) => {
    setHighlightedId(id);
    setActiveTab('memories');
  };

  const renderView = () => {
    switch (activeTab) {
      case 'capture':
        return <CaptureView />;
      case 'memories':
        return <MemoriesView highlightedMemoryId={highlightedId} />;
      case 'schedule':
        return <ScheduleView />;
      case 'search':
        return <SearchView onJumpToMemory={handleJumpToMemory} />;
      case 'settings':
        return <SettingsView />;
      default:
        return <CaptureView />;
    }
  };

  return (
    <div className="bg-dark min-h-[100dvh] text-foreground font-sans overflow-hidden transition-colors duration-300">
      <main className="h-[100dvh] w-full max-w-md mx-auto relative bg-dark shadow-2xl overflow-hidden flex flex-col">
           <div className="flex-1 overflow-hidden relative">
              {renderView()}
           </div>
           
           <div className="print:hidden">
              <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
           </div>
      </main>
    </div>
  );
}

export default App;
