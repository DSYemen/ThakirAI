
import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { CaptureView } from './components/CaptureView';
import { MemoriesView } from './components/MemoriesView';
import { SearchView } from './components/SearchView';
import { reminderService } from './services/reminderService';

function App() {
  const [activeTab, setActiveTab] = useState<'capture' | 'memories' | 'search'>('capture');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Initialize Background Reminder Service
  useEffect(() => {
    reminderService.init();
    
    // Cleanup on unmount
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
      case 'search':
        return <SearchView onJumpToMemory={handleJumpToMemory} />;
      default:
        return <CaptureView />;
    }
  };

  return (
    <div className="bg-dark min-h-[100dvh] text-white font-sans overflow-hidden">
      {/* Main Content Area - Full Height */}
      {/* Removed print:hidden to ensure the print template inside MemoriesView can be seen */}
      <main className="h-[100dvh] w-full max-w-md mx-auto relative bg-dark shadow-2xl overflow-hidden">
           {renderView()}
           
           {/* Navigation Overlay - Navigation handles its own print hiding if needed, or CSS visibility handles it */}
           <div className="print:hidden">
              <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
           </div>
      </main>
    </div>
  );
}

export default App;