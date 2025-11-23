import React, { useState } from 'react';
import { Navigation } from './components/Navigation';
import { CaptureView } from './components/CaptureView';
import { MemoriesView } from './components/MemoriesView';
import { SearchView } from './components/SearchView';

function App() {
  const [activeTab, setActiveTab] = useState<'capture' | 'memories' | 'search'>('capture');

  const renderView = () => {
    switch (activeTab) {
      case 'capture':
        return <CaptureView />;
      case 'memories':
        return <MemoriesView />;
      case 'search':
        return <SearchView />;
      default:
        return <CaptureView />;
    }
  };

  return (
    <div className="bg-dark min-h-screen text-white font-sans selection:bg-primary/30">
      {/* Header */}
      <header className="fixed top-0 w-full z-40 bg-dark/80 backdrop-blur-md border-b border-white/5 h-16 flex items-center justify-center px-4">
        <h1 className="text-lg font-bold tracking-wide flex items-center gap-2">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
             الذاكرة الذكية
          </span>
        </h1>
      </header>

      {/* Main Content Area */}
      <main className="pt-16 h-[calc(100vh-80px)] overflow-hidden relative">
        <div className="h-full w-full max-w-md mx-auto relative">
           {renderView()}
        </div>
      </main>

      {/* Navigation */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default App;
