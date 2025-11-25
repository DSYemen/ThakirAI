
import { MemoryItem, MediaType } from '../types';

const DB_NAME = 'ThakiraDB';
const STORE_NAME = 'memories';
const VERSION = 3; // Upgraded to add isPinned index

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

      // Add isFavorite index in version 2
      if (!store.indexNames.contains('isFavorite')) {
        store.createIndex('isFavorite', 'isFavorite', { unique: false });
      }

      // Add isPinned index in version 3
      if (!store.indexNames.contains('isPinned')) {
        store.createIndex('isPinned', 'isPinned', { unique: false });
      }
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

// Legacy getMemories (fetches all) - kept for backward compatibility with Search/App
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

export interface FilterOptions {
  type: MediaType | 'ALL';
  timeFilter: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR';
  showFavoritesOnly: boolean;
  showPinnedOnly: boolean; // Added pinned filter
  searchQuery: string;
  sortBy: 'DATE' | 'FAVORITES' | 'PINNED'; // Added sort by pinned
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
    
    // Determine Index and Direction
    let indexName = 'createdAt';
    if (filters.sortBy === 'FAVORITES') {
        indexName = 'isFavorite';
    } else if (filters.sortBy === 'PINNED') {
        indexName = 'isPinned';
    }
    
    const index = store.index(indexName);
    const direction = 'prev'; // Newest first (or true first for booleans)

    // Handle Cursor Range
    let range: IDBKeyRange | null = null;
    if (startCursor) {
      range = IDBKeyRange.upperBound(startCursor.value, true); 
      if (filters.sortBy === 'FAVORITES' || filters.sortBy === 'PINNED') {
          range = null; // Manual skipping for boolean indexes
      }
    }

    const request = index.openCursor(range, direction);
    
    const items: MemoryItem[] = [];
    let hasSkippedToCursor = !startCursor || (filters.sortBy !== 'FAVORITES' && filters.sortBy !== 'PINNED');

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
          cursor.continue();
          return;
      }

      const memory = cursor.value as MemoryItem;
      let matches = true;

      // --- Apply Filters ---
      
      // 1. Filter Type
      if (filters.type !== 'ALL' && memory.type !== filters.type) matches = false;

      // 2. Favorites Filter
      if (matches && filters.showFavoritesOnly && !memory.isFavorite) matches = false;

      // 3. Pinned Filter
      if (matches && filters.showPinnedOnly && !memory.isPinned) matches = false;

      // 4. Time Filter
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

      // 5. Search Query
      if (matches && filters.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          const text = (memory.transcription || memory.content || '').toLowerCase();
          const summary = (memory.summary || '').toLowerCase();
          const tags = (memory.tags || []).join(' ').toLowerCase();
          
          if (!text.includes(q) && !summary.includes(q) && !tags.includes(q)) {
              matches = false;
          }
      }

      if (matches) {
          items.push(memory);
      }

      if (items.length < limit) {
          cursor.continue();
      } else {
          const nextVal = cursor.key;
          const nextId = memory.id;
          resolve({ 
              items, 
              nextCursor: { value: nextVal, id: nextId } 
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
