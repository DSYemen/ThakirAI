import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { CaptureView } from './components/CaptureView';
import { MemoriesView } from './components/MemoriesView';
import { SearchView } from './components/SearchView';
import { getMemories, saveMemory } from './services/db';
import { ReminderFrequency } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<'capture' | 'memories' | 'search'>('capture');

  // Request Notification Permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  // Background Reminder Check Service
  useEffect(() => {
    const checkReminders = async () => {
      if ('Notification' in window && Notification.permission === 'granted') {
        const memories = await getMemories();
        const now = Date.now();

        for (const memory of memories) {
          if (memory.reminder && memory.reminder.timestamp <= now) {
            // 1. Trigger Notification
            new Notification("تذكير من الذاكرة الذكية", {
              body: memory.summary || "لديك ذكرى تستحق الاسترجاع!",
              icon: '/icon.png', // Assuming pwa icon exists, or fallback
              dir: 'rtl'
            });

            // 2. Handle Recurrence or Delete
            let updatedMemory = { ...memory };
            
            if (memory.reminder.frequency === 'ONCE') {
              delete updatedMemory.reminder;
            } else {
              // Calculate next occurrence
              const oldDate = new Date(memory.reminder.timestamp);
              const nextDate = new Date(oldDate);
              
              switch (memory.reminder.frequency) {
                case 'DAILY': nextDate.setDate(oldDate.getDate() + 1); break;
                case 'WEEKLY': nextDate.setDate(oldDate.getDate() + 7); break;
                case 'MONTHLY': nextDate.setMonth(oldDate.getMonth() + 1); break;
                case 'YEARLY': nextDate.setFullYear(oldDate.getFullYear() + 1); break;
              }
              
              // Ensure we don't set a time in the past if the app was closed for a long time
              // For a robust system, we might want to keep adding intervals until > now, 
              // but for this MVP, setting it to next logical interval relative to *scheduled time* is standard.
              // If that time is still in past, the next tick will catch it (or we can skip).
              // Let's just update the timestamp.
              updatedMemory.reminder = {
                ...memory.reminder,
                timestamp: nextDate.getTime()
              };
            }

            // 3. Save updates
            await saveMemory(updatedMemory);
          }
        }
      }
    };

    // Check every minute
    const intervalId = setInterval(checkReminders, 60000);
    
    // Initial check
    checkReminders();

    return () => clearInterval(intervalId);
  }, []);

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
    <div className="bg-dark min-h-[100dvh] text-white font-sans overflow-hidden">
      {/* Main Content Area - Full Height */}
      <main className="h-[100dvh] w-full max-w-md mx-auto relative bg-dark shadow-2xl overflow-hidden">
           {renderView()}
           
           {/* Navigation Overlay */}
           <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      </main>
    </div>
  );
}

export default App;