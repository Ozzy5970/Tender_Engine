/**
 * resilientStorage.ts
 * 
 * Purpose: "Platinum Standard" Persistence for Hostile Environments.
 * 
 * Strategy (Tiered Fallback):
 * 1. Try LocalStorage (Fast, Standard).
 * 2. If Blocked/Failed -> Try IndexedDB (Robust, Unlimited Size).
 * 3. If Blocked/Unknown -> Try Chunked Cookies (Bypass 4KB Limit).
 * 4. Last Resort -> Memory (Session only).
 */

const DB_NAME = 'auth-db';
const STORE_NAME = 'session-store';

// --- 1. IndexedDB Helper (Async, Large Storage) ---
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
        } catch (e) { return null; }
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
        } catch (e) { /* Ignore */ }
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
        } catch (e) { /* Ignore */ }
    }
};

// --- 2. Cookie Helper with CHUNKING (Bypass 4KB Limit) ---
const CookieJar = {
    set: (name: string, value: string) => {
        try {
            const d = new Date();
            d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000));
            // Only Secure if HTTPS (for localhost compat)
            const secure = window.location.protocol === 'https:' ? ';Secure' : '';
            const baseOptions = `;expires=${d.toUTCString()};path=/;SameSite=Lax${secure}`;

            // Chunking Logic (Limit 2000 chars per cookie to be safe)
            const CHUNK_SIZE = 2000;
            if (value.length <= CHUNK_SIZE) {
                document.cookie = `${name}=${encodeURIComponent(value)}${baseOptions}`;
                // Clean up chunks if they existed smoothly
                CookieJar.removeChunks(name);
            } else {
                // Split it up
                let i = 0;
                while (value.length > 0) {
                    const chunk = value.substring(0, CHUNK_SIZE);
                    value = value.substring(CHUNK_SIZE);
                    document.cookie = `${name}.${i}=${encodeURIComponent(chunk)}${baseOptions}`;
                    i++;
                }
                // Mark main cookie as "chunked"
                document.cookie = `${name}=CHUNKED${baseOptions}`;
            }
        } catch (e) { console.warn("Cookie Write Failed", e) }
    },

    get: (name: string): string | null => {
        try {
            const getCookie = (n: string) => {
                const match = document.cookie.match(new RegExp('(^| )' + n.replace(/\./g, '\\.') + '=([^;]+)'));
                return match ? decodeURIComponent(match[2]) : null;
            };

            const val = getCookie(name);
            if (!val) return null;

            if (val === 'CHUNKED') {
                // Reassemble
                let fullVal = '';
                let i = 0;
                while (true) {
                    const chunk = getCookie(`${name}.${i}`);
                    if (!chunk) break;
                    fullVal += chunk;
                    i++;
                }
                return fullVal || null;
            }
            return val;
        } catch (e) { return null }
    },

    remove: (name: string) => {
        const expire = ";expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/";
        document.cookie = `${name}=${expire}`;
        CookieJar.removeChunks(name);
    },

    removeChunks: (name: string) => {
        const expire = ";expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/";
        let i = 0;
        // blindly try to remove up to 10 chunks
        while (i < 10) {
            document.cookie = `${name}.${i}=${expire}`;
            i++;
        }
    }
}


const memoryStore = new Map<string, string>();

// --- Timeout Helper (Prevents SES Hangs) ---
const timeoutPromise = <T>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), ms))
    ]);
};

export const resilientStorage = {
    // Supabase allows async storage adapters
    getItem: async (key: string): Promise<string | null> => {
        // 1. Try LocalStorage
        try {
            const val = localStorage.getItem(key);
            if (val) return val;
        } catch (e) { /* LS Blocked */ }

        // 2. Try IndexedDB (Robust Fallback)
        // CRITICAL FIX: Wrap in 500ms timeout to prevent SES hangs
        const dbVal = await timeoutPromise(idb.get(key), 500, null);
        if (dbVal) {
            console.log(`💾 Restored from IndexedDB: ${key}`);
            return dbVal;
        }

        // 3. Try Cookie (Chunked)
        const cookieVal = CookieJar.get(key);
        if (cookieVal) {
            console.log(`🍪 Restored from Chunked Cookie: ${key}`);
            return cookieVal;
        }

        // 4. Memory
        return memoryStore.get(key) || null;
    },

    setItem: async (key: string, value: string): Promise<void> => {
        let wroteToDisk = false;

        // 1. LocalStorage
        try {
            localStorage.setItem(key, value);
            if (localStorage.getItem(key)) wroteToDisk = true;
        } catch (e) { console.warn(`⚠️ LS blocked: ${key}`); }

        // 2. IndexedDB (Always write as backup)
        try {
            // CRITICAL FIX: Wrap in 500ms timeout
            await timeoutPromise(idb.set(key, value), 500, undefined);
            if (!wroteToDisk) console.log(`💾 Scsved to IDB: ${key}`);
        } catch (e) { console.error("IDB Fail", e); }

        // 3. Cookies (Fallback if LS failed)
        // If LS failed, we MUST write to cookie to ensure survival across tabs/restarts
        if (!wroteToDisk) {
            CookieJar.set(key, value);
            console.log(`🍪 Saved to Chunked Cookie: ${key}`);
        }

        // 4. Memory
        memoryStore.set(key, value);
    },

    removeItem: async (key: string): Promise<void> => {
        try { localStorage.removeItem(key); } catch (e) { }
        await timeoutPromise(idb.remove(key), 500, undefined);
        CookieJar.remove(key);
        memoryStore.delete(key);
    },
}
