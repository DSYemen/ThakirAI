
import { MemoryItem, MediaType } from '../types';

const DB_NAME = 'ThakiraDB';
const STORE_NAME = 'memories';
const VERSION = 6; // Upgraded to 6 for schedule features

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction;
      
      let store: IDBObjectStore;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      } else {
        store = transaction!.objectStore(STORE_NAME);
      }

      if (!store.indexNames.contains('isFavorite')) {
        store.createIndex('isFavorite', 'isFavorite', { unique: false });
      }

      if (!store.indexNames.contains('isPinned')) {
        store.createIndex('isPinned', 'isPinned', { unique: false });
      }

      if (!store.indexNames.contains('reminderTimestamp')) {
        store.createIndex('reminderTimestamp', 'reminder.timestamp', { unique: false });
      }

      if (!store.indexNames.contains('isFavorite_createdAt')) {
        store.createIndex('isFavorite_createdAt', ['isFavorite', 'createdAt'], { unique: false });
      }
      if (!store.indexNames.contains('isPinned_createdAt')) {
        store.createIndex('isPinned_createdAt', ['isPinned', 'createdAt'], { unique: false });
      }
      
      // Migration logic is handled automatically by IndexedDB on upgrade
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveMemory = async (memory: MemoryItem): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(memory);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getMemories = async (): Promise<MemoryItem[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('createdAt');
    const request = index.openCursor(null, 'prev');
    const results: MemoryItem[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const getMemoryById = async (id: string): Promise<MemoryItem | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getDueReminders = async (timestamp: number): Promise<MemoryItem[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    if (!store.indexNames.contains('reminderTimestamp')) {
        resolve([]);
        return;
    }
    const index = store.index('reminderTimestamp');
    const range = IDBKeyRange.upperBound(timestamp);
    const request = index.getAll(range);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// New function to get ALL scheduled items sorted by date
export const getAllReminders = async (): Promise<MemoryItem[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    if (!store.indexNames.contains('reminderTimestamp')) {
        resolve([]);
        return;
    }

    const index = store.index('reminderTimestamp');
    const request = index.getAll(); // Get all

    request.onsuccess = () => {
        // We might want to sort them manually if the index order isn't sufficient or if we want to filter empty reminders
        const results = (request.result as MemoryItem[]).filter(m => m.reminder);
        results.sort((a, b) => (a.reminder!.timestamp - b.reminder!.timestamp));
        resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

export interface FilterOptions {
  type: MediaType | 'ALL';
  timeFilter: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR';
  showFavoritesOnly: boolean;
  showPinnedOnly: boolean;
  searchQuery: string;
  sortBy: 'DATE' | 'FAVORITES' | 'PINNED';
}

export interface PagedResult {
  items: MemoryItem[];
  nextCursor: { value: any; id: string } | null;
}

export const getPagedMemories = async (
  limit: number,
  startCursor: { value: any; id: string } | null,
  filters: FilterOptions
): Promise<PagedResult> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    let indexName = 'createdAt';
    if (filters.sortBy === 'FAVORITES') indexName = 'isFavorite_createdAt';
    else if (filters.sortBy === 'PINNED') indexName = 'isPinned_createdAt';
    
    if (!store.indexNames.contains(indexName)) indexName = 'createdAt';

    const index = store.index(indexName);
    const direction = 'prev';

    let range: IDBKeyRange | null = null;
    if (startCursor) {
      range = IDBKeyRange.upperBound(startCursor.value, true); 
    }

    const request = index.openCursor(range, direction);
    
    const items: MemoryItem[] = [];
    let hasSkippedToCursor = !startCursor;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      
      if (!cursor) {
        resolve({ items, nextCursor: null });
        return;
      }

      if (!hasSkippedToCursor && startCursor) {
          if (cursor.value.id === startCursor.id) {
              hasSkippedToCursor = true;
          }
      }

      const memory = cursor.value as MemoryItem;
      let matches = true;

      if (filters.type !== 'ALL' && memory.type !== filters.type) matches = false;
      if (matches && filters.showFavoritesOnly && !memory.isFavorite) matches = false;
      if (matches && filters.showPinnedOnly && !memory.isPinned) matches = false;

      if (matches && filters.timeFilter !== 'ALL') {
          const date = new Date(memory.createdAt);
          const now = new Date();
          const diffTime = now.getTime() - date.getTime();
          const diffDays = diffTime / (1000 * 3600 * 24);
          
          if (filters.timeFilter === 'TODAY') {
             if (date.getDate() !== now.getDate() || date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) matches = false;
          } else if (filters.timeFilter === 'WEEK' && diffDays > 7) matches = false;
          else if (filters.timeFilter === 'MONTH' && diffDays > 30) matches = false;
          else if (filters.timeFilter === 'YEAR' && diffDays > 365) matches = false;
      }

      if (matches && filters.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          const text = (memory.transcription || memory.content || '').toLowerCase();
          const summary = (memory.summary || '').toLowerCase();
          const tags = (memory.tags || []).join(' ').toLowerCase();
          if (!text.includes(q) && !summary.includes(q) && !tags.includes(q)) matches = false;
      }

      if (matches) {
          items.push(memory);
      }

      if (items.length < limit) {
          cursor.continue();
      } else {
          resolve({ 
              items, 
              nextCursor: { value: cursor.key, id: memory.id } 
          });
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteMemory = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// === IMPORT / EXPORT / CLEAR ===

export const exportDatabase = async (): Promise<string> => {
    const items = await getMemories();
    const backup = {
        version: VERSION,
        timestamp: Date.now(),
        data: items
    };
    return JSON.stringify(backup);
};

export const importDatabase = async (jsonData: string): Promise<boolean> => {
    try {
        const backup = JSON.parse(jsonData);
        if (!backup.data || !Array.isArray(backup.data)) {
            throw new Error("Invalid backup format");
        }

        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            // Clear existing data
            const clearReq = store.clear();
            
            clearReq.onsuccess = () => {
                let count = 0;
                backup.data.forEach((item: MemoryItem) => {
                    store.put(item);
                    count++;
                });
                
                // Wait for transaction complete
                transaction.oncomplete = () => resolve(true);
            };
            
            clearReq.onerror = () => reject(clearReq.error);
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (e) {
        console.error("Import failed", e);
        return false;
    }
};

export const clearDatabase = async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};
