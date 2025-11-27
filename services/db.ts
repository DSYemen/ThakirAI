
import { MemoryItem, MediaType } from '../types';

const DB_NAME = 'ThakiraDB';
const STORE_NAME = 'memories';
const VERSION = 5; // Upgraded to add compound indices for sorting

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

      // Add reminderTimestamp index in version 4
      if (!store.indexNames.contains('reminderTimestamp')) {
        store.createIndex('reminderTimestamp', 'reminder.timestamp', { unique: false });
      }

      // Version 5: Add compound indices for sorting and migrate data
      if (!store.indexNames.contains('isFavorite_createdAt')) {
        store.createIndex('isFavorite_createdAt', ['isFavorite', 'createdAt'], { unique: false });
      }
      if (!store.indexNames.contains('isPinned_createdAt')) {
        store.createIndex('isPinned_createdAt', ['isPinned', 'createdAt'], { unique: false });
      }

      // Migration: Backfill default values for existing items to ensure they appear in the new indices
      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest).result;
          if (cursor) {
              const item = cursor.value;
              let changed = false;
              if (item.isFavorite === undefined) {
                  item.isFavorite = false;
                  changed = true;
              }
              if (item.isPinned === undefined) {
                  item.isPinned = false;
                  changed = true;
              }
              if (changed) {
                  cursor.update(item);
              }
              cursor.continue();
          }
      };
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

// Efficiently get only reminders that are due
export const getDueReminders = async (timestamp: number): Promise<MemoryItem[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    // Ensure the index exists (safeguard)
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
    // Use compound indices for optimized sorting
    let indexName = 'createdAt';
    if (filters.sortBy === 'FAVORITES') {
        indexName = 'isFavorite_createdAt';
    } else if (filters.sortBy === 'PINNED') {
        indexName = 'isPinned_createdAt';
    }
    
    // Fallback if index doesn't exist (e.g. older DB version before upgrade completes)
    if (!store.indexNames.contains(indexName)) {
        indexName = 'createdAt';
    }

    const index = store.index(indexName);
    const direction = 'prev'; // Newest first (or true first for booleans)

    // Handle Cursor Range
    let range: IDBKeyRange | null = null;
    if (startCursor) {
      // Use true (open interval) to skip the exact match of the last item.
      // This works for both simple keys and array keys (compound indices).
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

      // Redundant safety check for ID collision if timestamp/value matches exactly
      // (Rare with upperBound true, but possible if duplicates exist in index key)
      if (!hasSkippedToCursor && startCursor) {
          if (cursor.value.id === startCursor.id) {
              hasSkippedToCursor = true;
          }
          // If we used upperBound(val, true), we likely don't hit this unless key collision.
          // If we hit a collision (same key, different ID), we might need to skip.
          // For now, assume upperBound handled it or we just process.
          // In 'prev' direction with duplicate keys, IDs might not be sorted as expected 
          // to simply skip by equality, so we rely on range.
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
          // Capture the cursor value for the next page.
          // For compound index, this will be an array [boolean, timestamp].
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
