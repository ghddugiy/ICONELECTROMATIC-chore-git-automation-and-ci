/**
 * ImageStorage — Persistent Local Image Storage via IndexedDB
 * Prevents localStorage 5MB quota overflow by saving image blobs in IndexedDB.
 * Supports file uploads, replacement, deletion, and provides instant object URLs.
 */

const DB_NAME = 'IconElectromatic_CMS';
const DB_VERSION = 1;
const STORE_NAME = 'cms_images';

// In-memory cache: id -> blobUrl (or dataUrl)
const memoryCache = new Map();
let dbPromise = null;

function getDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('IndexedDB failed to open, falling back to in-memory storage.', request.error);
      resolve(null);
    };
  });
  return dbPromise;
}

export const ImageStorage = {
  /**
   * Pre-load all saved images into memoryCache so synchronous lookups work.
   */
  async init() {
    const db = await getDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          (req.result || []).forEach(item => {
            if (item && item.id && item.blob) {
              const url = URL.createObjectURL(item.blob);
              memoryCache.set(item.id, url);
            }
          });
          resolve();
        };
        req.onerror = () => resolve();
      } catch (err) {
        console.warn('Error reading images from IndexedDB:', err);
        resolve();
      }
    });
  },

  /**
   * Store a File or Blob in IndexedDB.
   * Returns a persistent identifier key: 'idb:img_<timestamp>'
   */
  async saveImage(fileOrBlob, customId = null) {
    const id = customId || `idb:img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const db = await getDB();

    // Cache object URL immediately
    const blobUrl = URL.createObjectURL(fileOrBlob);
    memoryCache.set(id, blobUrl);

    if (db) {
      await new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put({
            id,
            blob: fileOrBlob,
            name: fileOrBlob.name || 'image',
            type: fileOrBlob.type || 'image/jpeg',
            updatedAt: Date.now()
          });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
    }

    return id;
  },

  /**
   * Cache a resolved preview URL in memory (e.g. presigned R2 preview).
   */
  setCachedUrl(key, url) {
    if (key && url) {
      memoryCache.set(key, url);
    }
  },

  /**
   * Resolve an image identifier or URL.
   * If it starts with 'idb:', returns the cached blob object URL.
   * If it's an R2 reference or regular asset path (/images/...) or external URL, returns as-is.
   */
  resolveImageUrl(urlOrId) {
    if (!urlOrId) return '';
    if (typeof urlOrId !== 'string') return '';
    if (memoryCache.has(urlOrId)) {
      return memoryCache.get(urlOrId);
    }
    if (urlOrId.startsWith('idb:')) {
      // If not yet in cache, schedule async load and return placeholder or fallback
      this.fetchAndCache(urlOrId);
      return urlOrId;
    }
    return urlOrId;
  },

  /**
   * Async fetch from IndexedDB if missed cache.
   */
  async fetchAndCache(id) {
    if (memoryCache.has(id)) return memoryCache.get(id);
    const db = await getDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result && req.result.blob) {
            const url = URL.createObjectURL(req.result.blob);
            memoryCache.set(id, url);
            // Update any existing DOM elements matching this ID
            document.querySelectorAll(`img[src="${id}"], img[data-idb="${id}"]`).forEach(img => {
              img.src = url;
            });
            resolve(url);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  },

  /**
   * Delete an image from IndexedDB and free memory cache.
   */
  async deleteImage(id) {
    if (!id || !id.startsWith('idb:')) return;
    const cached = memoryCache.get(id);
    if (cached) {
      try { URL.revokeObjectURL(cached); } catch (e) {}
      memoryCache.delete(id);
    }
    const db = await getDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch (err) {
        resolve();
      }
    });
  },

  /**
   * Helper to scan a DOM container and resolve any idb: images that haven't been resolved yet.
   */
  resolveAllImagesInContainer(container = document) {
    if (!container) return;
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (src && src.startsWith('idb:')) {
        const resolved = this.resolveImageUrl(src);
        if (resolved && resolved !== src) {
          img.src = resolved;
          img.setAttribute('data-idb', src);
        }
      }
    });
  }
};
