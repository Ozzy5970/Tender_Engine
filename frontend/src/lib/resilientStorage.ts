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
            // Fix: Only use Secure if actually on HTTPS to allow localhost testing
            const secure = window.location.protocol === 'https:' ? ';Secure' : '';
            document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax${secure}`;
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
        if (cookieVal) {
            console.log(`🍪 💾 Restored session from Backup Cookie: ${key}`);
            return cookieVal;
        }

        // 3. Try Memory
        return memoryStore.get(key) || null;
    },

    setItem: (key: string, value: string): void => {
        let wroteToDisk = false;

        // 1. Try LocalStorage
        try {
            localStorage.setItem(key, value);
            // Verify it actually wrote (some browsers fail silently)
            if (localStorage.getItem(key)) {
                wroteToDisk = true;
            }
        } catch (e) {
            console.warn(`⚠️ LocalStorage blocked/failed (${key}).`);
        }

        // 2. Try Cookie
        // If LS failed OR we just want to be safe, we use cookie as backup.
        // CHANGE: Always write to cookie if LS didn't confirm write.
        if (!wroteToDisk) {
            console.log(`🍪 Writing to Backup Cookie: ${key}`);
            CookieJar.set(key, value);
        } else {
            // Optional: Clear cookie to avoid duplicate state? 
            // No, keep it as backup in case user clears LS but not Cookies.
            // Actually, let's sync them. If LS works, write to Cookie too?
            // No, that doubles the write. Stick to fallback for now.
        }

        // 3. Always update Memory
        memoryStore.set(key, value);
    },

    removeItem: (key: string): void => {
        // Nuke everything to be safe
        try { localStorage.removeItem(key); } catch (e) { }
        CookieJar.remove(key);
        memoryStore.delete(key);
    },
}
