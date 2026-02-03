/**
 * resilientStorage.ts
 * 
 * Purpose: "Defensive Persistence" with Tiered Fallback.
 * Strategy:
 * 1. Try LocalStorage (Preferred, Standard).
 * 2. If blocked, try Cookies (Persistent Backup).
 * 3. If blocked, use Memory (Volatile Last Resort).
 */

const memoryStore = new Map<string, string>();

// Simple Cookie Helper (No external deps)
const CookieJar = {
    set: (name: string, value: string) => {
        try {
            const d = new Date();
            d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000));
            // SameSite=Lax allows auth across redirects (OAuth)
            document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax;Secure`;
        } catch (e) { /* Ignore cookie errors */ }
    },
    get: (name: string): string | null => {
        try {
            const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
            return match ? decodeURIComponent(match[2]) : null;
        } catch (e) { return null }
    },
    remove: (name: string) => {
        try {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;SameSite=Lax;Secure`;
        } catch (e) { /* Ignore */ }
    }
}

export const resilientStorage = {
    getItem: (key: string): string | null => {
        // 1. Try LocalStorage
        try {
            const val = localStorage.getItem(key);
            if (val) return val;
        } catch (e) { /* LS Blocked */ }

        // 2. Try Cookie (Backup)
        const cookieVal = CookieJar.get(key);
        if (cookieVal) return cookieVal;

        // 3. Try Memory
        return memoryStore.get(key) || null;
    },

    setItem: (key: string, value: string): void => {
        let wroteToDisk = false;

        // 1. Try LocalStorage
        try {
            localStorage.setItem(key, value);
            wroteToDisk = true;
        } catch (e) {
            console.warn(`⚠️ LocalStorage blocked (${key}). Falling back to Cookie.`);
        }

        // 2. Try Cookie (Always write to cookie if LS failed, or as backup?)
        // Strategy: If LS failed, definitely write cookie.
        if (!wroteToDisk) {
            CookieJar.set(key, value);
        }

        // 3. Always update Memory for speed
        memoryStore.set(key, value);
    },

    removeItem: (key: string): void => {
        // Nuke everything to be safe
        try { localStorage.removeItem(key); } catch (e) { }
        CookieJar.remove(key);
        memoryStore.delete(key);
    },
}
