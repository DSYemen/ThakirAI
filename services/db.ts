import { MemoryItem, MediaType } from '../types';

const DB_NAME = 'ThakiraDB';
const STORE_NAME = 'memories';
const VERSION = 2; // Upgraded to add new indexes

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

export interface FilterOptions {
  type: MediaType | 'ALL';
  timeFilter: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR';
  showFavoritesOnly: boolean;
  searchQuery: string;
  sortBy: 'DATE' | 'FAVORITES';
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
    }
    
    const index = store.index(indexName);
    const direction = 'prev'; // Newest first (or true first for booleans)

    // Handle Cursor Range
    let range: IDBKeyRange | null = null;
    if (startCursor) {
      // If we have a cursor, we want items AFTER this cursor value.
      // Since direction is 'prev' (descending), "after" means "less than".
      // However, IDB openCursor with starting key is tricky with duplicates.
      // We essentially just open the cursor and advance/continue until we find the spot.
      // A better way for simple pagination is using range upperBound.
      range = IDBKeyRange.upperBound(startCursor.value, true); 
      // Note: This logic works well for createdAt (unique-ish). 
      // For isFavorite (lots of duplicates), upperBound might skip legitimate items with same value but diff ID.
      // So for isFavorite, we might rely on filtering manually or standard iteration.
      if (filters.sortBy === 'FAVORITES') {
          range = null; // We'll handle skipping manually for simplicity in this robust implementation
      }
    }

    const request = index.openCursor(range, direction);
    
    const items: MemoryItem[] = [];
    let hasSkippedToCursor = !startCursor || filters.sortBy !== 'FAVORITES'; // If by date, range handles it. If favorite, we skip manually.

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      
      if (!cursor) {
        resolve({ items, nextCursor: null });
        return;
      }

      // If sorting by Favorites (duplicates), we need to manually skip until we pass the last loaded ID
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

      // 2. Favorites Filter (if not already sorted by it)
      if (matches && filters.showFavoritesOnly && !memory.isFavorite) matches = false;

      // 3. Time Filter
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

      // 4. Search Query (Simple client-side match in DB loop)
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
          // Found enough items for this page
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