/**
 * resilientStorage.ts
 * 
 * Purpose: "Platinum Standard" Persistence.
 * Strategy:
 * 1. Try LocalStorage (Fast, Standard).
 * 2. If Blocked or Failed, use IndexedDB ( robust, unlimited size).
 * 3. Memory as last resort.
 * 
 * Note: IndexedDB is Async. We convert this adapter to be fully Async, 
 * which Supabase supports.
 */

const DB_NAME = 'auth-db';
const STORE_NAME = 'session-store';

// --- Internal IDB Helper ---
const idb = {
    getDB: async (): Promise<IDBDatabase> => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
        });
    },

    get: async (key: string): Promise<string | null> => {
        try {
            const db = await idb.getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.warn("IDB Get Error:", e);
            return null;
        }
    },

    set: async (key: string, value: string): Promise<void> => {
        try {
            const db = await idb.getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.put(value, key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.warn("IDB Set Error:", e);
        }
    },

    remove: async (key: string): Promise<void> => {
        try {
            const db = await idb.getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.delete(key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.warn("IDB Remove Error:", e);
        }
    }
};

const memoryStore = new Map<string, string>();

export const resilientStorage = {
    // Supabase allows async storage adapters
    getItem: async (key: string): Promise<string | null> => {
        // 1. Try LocalStorage (Fastest)
        try {
            const val = localStorage.getItem(key);
            if (val) return val;
        } catch (e) { /* LS Blocked */ }

        // 2. Try IndexedDB (Robust Fallback)
        const dbVal = await idb.get(key);
        if (dbVal) {
            console.log(`💾 Restored session from IndexedDB: ${key}`);
            return dbVal;
        }

        // 3. Try Memory
        return memoryStore.get(key) || null;
    },

    setItem: async (key: string, value: string): Promise<void> => {
        let wroteToDisk = false;

        // 1. Try LocalStorage
        try {
            localStorage.setItem(key, value);
            // Verify
            if (localStorage.getItem(key)) {
                wroteToDisk = true;
            }
        } catch (e) {
            console.warn(`⚠️ LocalStorage blocked (${key}).`);
        }

        // 2. Always backup to IndexedDB if LS failed OR just to be safe?
        // Let's always write to IDB as a true persistent backup.
        // It's non-blocking (async) to the main thread logic mostly, but we await it here.
        // If LS failed, we rely on it. If LS worked, it's a backup.
        try {
            await idb.set(key, value);
            if (!wroteToDisk) {
                console.log(`💾 Saved session to IndexedDB (Backup): ${key}`);
            }
        } catch (e) { console.error("IDB Write Failed", e); }

        // 3. Memory
        memoryStore.set(key, value);
    },

    removeItem: async (key: string): Promise<void> => {
        try { localStorage.removeItem(key); } catch (e) { }
        await idb.remove(key);
        memoryStore.delete(key);
    },
}
