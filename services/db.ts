
import { MemoryItem, MediaType } from '../types';

const DB_NAME = 'ThakiraDB';
const STORE_NAME = 'memories';
const VERSION = 9; // Upgraded to 9 for type_createdAt index optimization

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
      
      // New index for offline sync
      if (!store.indexNames.contains('analysisStatus')) {
        store.createIndex('analysisStatus', 'analysisStatus', { unique: false });
      }

      // New index for optimized Type filtering sorted by Date
      if (!store.indexNames.contains('type_createdAt')) {
        store.createIndex('type_createdAt', ['type', 'createdAt'], { unique: false });
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

export const getAllTags = async (): Promise<string[]> => {
  const memories = await getMemories();
  const tagCounts: Record<string, number> = {};

  memories.forEach(memory => {
    if (memory.tags && Array.isArray(memory.tags)) {
      memory.tags.forEach(tag => {
        const t = tag.trim();
        if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    }
  });

  // Return tags sorted by frequency
  return Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
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
    const request = index.getAll();

    request.onsuccess = () => {
        const results = (request.result as MemoryItem[]).filter(m => m.reminder);
        results.sort((a, b) => (a.reminder!.timestamp - b.reminder!.timestamp));
        resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

// New function to get memories pending analysis (for offline sync)
export const getPendingMemories = async (): Promise<MemoryItem[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    if (!store.indexNames.contains('analysisStatus')) {
        resolve([]);
        return;
    }

    const index = store.index('analysisStatus');
    const request = index.getAll('PENDING');

    request.onsuccess = () => resolve(request.result || []);
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
    
    // 1. Intelligent Index Selection
    let indexName = 'createdAt';
    if (filters.sortBy === 'FAVORITES') {
        indexName = 'isFavorite_createdAt';
    } else if (filters.sortBy === 'PINNED') {
        indexName = 'isPinned_createdAt';
    } else if (filters.type !== 'ALL') {
        // Optimization: Use type_createdAt if filtering by type and sorting by date
        // This avoids scanning all media types when we only want one specific type
        indexName = 'type_createdAt';
    }
    
    // Fallback if index doesn't exist (e.g. during migration)
    if (!store.indexNames.contains(indexName)) indexName = 'createdAt';

    const index = store.index(indexName);
    const direction = 'prev'; // Descending order (newest/favorite first)

    // 2. Construct Key Range
    let range: IDBKeyRange | null = null;

    if (indexName === 'type_createdAt' && filters.type !== 'ALL') {
        // If optimizing by type, bound the range to that type
        // Upper Bound (Start): [Type, MaxDate] OR [Type, CursorDate]
        // Lower Bound (End): [Type, 0]
        const type = filters.type;
        const upper = startCursor ? startCursor.value : [type, Number.MAX_SAFE_INTEGER];
        const lower = [type, 0];
        
        // exclusive upper bound if cursor exists (skip the item we just saw)
        range = IDBKeyRange.bound(lower, upper, false, !!startCursor);
    } else {
        // Standard indices
        if (startCursor) {
             range = IDBKeyRange.upperBound(startCursor.value, true); 
        }
    }

    const request = index.openCursor(range, direction);
    
    const items: MemoryItem[] = [];
    
    // We already handle the cursor skipping via IDBKeyRange above,
    // but strict safety check if indices differ slightly
    let hasSkippedToCursor = !startCursor;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      
      if (!cursor) {
        resolve({ items, nextCursor: null });
        return;
      }

      // Safety: Double check we passed the cursor if range calculation was fuzzy
      if (!hasSkippedToCursor && startCursor) {
          if (cursor.value.id === startCursor.id) {
              hasSkippedToCursor = true;
          }
      }

      const memory = cursor.value as MemoryItem;
      let matches = true;

      // 3. Filter Logic
      // Note: If using 'type_createdAt', the type check is implicit, but we keep it for safety.
      if (filters.type !== 'ALL' && memory.type !== filters.type) matches = false;
      
      // If sorting by favorites, the index handles order, but we might still need to filter by pinned/type
      if (matches && filters.showFavoritesOnly && !memory.isFavorite) matches = false;
      if (matches && filters.showPinnedOnly && !memory.isPinned) matches = false;

      // Time Filter (Complex logic not indexable easily)
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

      // Search Filter (Full text scan required on results)
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
            const clearReq = store.clear();
            
            clearReq.onsuccess = () => {
                backup.data.forEach((item: MemoryItem) => {
                    store.put(item);
                });
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
