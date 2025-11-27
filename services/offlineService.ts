
import { getPendingMemories, saveMemory } from './db';
import { analyzeMedia } from './geminiService';
import { reminderService } from './reminderService';
import { MemoryItem, MediaType } from '../types';

class OfflineService {
    private isOnline: boolean = navigator.onLine;
    private listeners: ((online: boolean) => void)[] = [];
    private syncInProgress = false;

    init() {
        window.addEventListener('online', () => {
            console.log("Network restored. Syncing...");
            this.isOnline = true;
            this.notifyListeners();
            this.syncPendingItems();
        });
        window.addEventListener('offline', () => {
            console.log("Network lost.");
            this.isOnline = false;
            this.notifyListeners();
        });
        
        // Initial sync check
        if (this.isOnline) {
            this.syncPendingItems();
        }
    }

    subscribe(listener: (online: boolean) => void) {
        this.listeners.push(listener);
        listener(this.isOnline);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(l => l(this.isOnline));
    }

    get online() { return this.isOnline; }

    async syncPendingItems() {
        if (this.syncInProgress || !this.isOnline) return;
        this.syncInProgress = true;

        try {
            const pending = await getPendingMemories();
            if (pending.length === 0) {
                this.syncInProgress = false;
                return;
            }

            console.log(`Found ${pending.length} pending items to sync.`);

            for (const memory of pending) {
                if (!this.isOnline) break; // Stop if connection drops

                try {
                    // Use stored userContext (input text) if available
                    const context = memory.metadata?.userContext || "";
                    
                    let analysis;
                    if (memory.type === MediaType.TEXT) {
                         // For text, the content is the input
                         analysis = await analyzeMedia(memory.type, "", memory.content);
                    } else {
                         analysis = await analyzeMedia(memory.type, memory.content, context);
                    }

                    // Logic similar to CaptureView's success handler
                    let finalReminder = memory.reminder;
                    if (!finalReminder && analysis.detectedReminder) {
                         finalReminder = {
                            timestamp: new Date(analysis.detectedReminder.isoTimestamp).getTime(),
                            frequency: analysis.detectedReminder.frequency,
                            interval: analysis.detectedReminder.interval || 1
                        };
                    }

                    const updatedMemory: MemoryItem = {
                        ...memory,
                        transcription: analysis.transcription,
                        summary: analysis.summary,
                        tags: analysis.tags,
                        reminder: finalReminder,
                        analysisStatus: 'COMPLETED'
                    };

                    await saveMemory(updatedMemory);
                    if (finalReminder) {
                        await reminderService.scheduleNotification(updatedMemory);
                    }
                    console.log(`Synced memory ${memory.id}`);
                    
                } catch (e) {
                    console.error("Failed to sync memory", memory.id, e);
                    // Keep status as PENDING to retry later, or implement retry count
                }
            }
            
            // Trigger a UI update (optional, relying on live queries usually)
            window.dispatchEvent(new CustomEvent('thakira-sync-complete'));

        } catch (error) {
            console.error("Sync process error", error);
        } finally {
            this.syncInProgress = false;
        }
    }
}

export const offlineService = new OfflineService();
