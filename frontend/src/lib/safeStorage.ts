/**
 * SafeStorage Adapter for Supabase
 * 
 * Purpose: "Cushion the blow" when extensions (like MetaMask/Lockdown) block localStorage.
 * Strategy: Try localStorage. If it throws (SecurityError/AccessDenied), fall back to in-memory Map.
 * Result: User stays logged in for the session (tab), even if persistence is blocked. Graceful degradation.
 */

const memoryStorage = new Map<string, string>();

export const resultientStorage = {
    getItem: (key: string): string | null => {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            console.warn("⚠️ localStorage blocked (Extension?). Using memory fallback for read:", key);
            return memoryStorage.get(key) || null;
        }
    },
    setItem: (key: string, value: string): void => {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.warn("⚠️ localStorage blocked (Extension?). Using memory fallback for write:", key);
            memoryStorage.set(key, value);
        }
    },
    removeItem: (key: string): void => {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn("⚠️ localStorage blocked. Using memory fallback for delete:", key);
            memoryStorage.delete(key);
        }
    },
};
