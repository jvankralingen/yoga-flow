'use client';

const DB_NAME = 'yoga-audio-cache';
const DB_VERSION = 1;
const STORE_NAME = 'audio';

interface CachedAudio {
  text: string;
  blob: Blob;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'text' });
      }
    };
  });
}

export async function getCachedAudio(text: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(text);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as CachedAudio | undefined;
        resolve(result?.blob || null);
      };
    });
  } catch (error) {
    console.error('Failed to get cached audio:', error);
    return null;
  }
}

export async function setCachedAudio(text: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({
        text,
        blob,
        createdAt: Date.now(),
      } as CachedAudio);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Failed to cache audio:', error);
  }
}

export async function clearAudioCache(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Failed to clear audio cache:', error);
  }
}
