/**
 * resilientStorage.ts
 * 
 * Purpose: "Defensive Persistence".
 * Strategy:
 * 1. Try LocalStorage (Preferred).
 * 2. If blocked (Extension/SecurityError) -> Fallback to Memory.
 * 
 * "Hard Truth" Alignment:
 * - Extensions break LocalStorage.
 * - We do NOT try to detect extensions.
 * - We just catch the error and move on.
 * - We do NOT use Cookies (risk of size limits/truncation).
 * - Implication: If LS is restricted, session is lost on refresh. This is acceptable vs the alternative (Crash/Loop).
 */

const memoryStore = new Map<string, string>();

export const resilientStorage = {
    getItem: (key: string): string | null => {
        try {
            const val = localStorage.getItem(key);
            // If we have a value, return it.
            // If val is null, it typically means "not found", BUT if we were blocked from writing to LS earlier,
            // it might exist in memoryStore. So we fallback to memory check.
            return val ?? memoryStore.get(key) ?? null;
        } catch (error) {
            // Extension blocked read? Return memory
            console.warn(`⚠️ Storage Read Blocked (${key}). Using Memory.`);
            return memoryStore.get(key) || null;
        }
    },
    setItem: (key: string, value: string): void => {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            // Extension blocked write? Use memory
            console.warn(`⚠️ Storage Write Blocked (${key}). Using Memory.`);
            memoryStore.set(key, value);
        }
    },
    removeItem: (key: string): void => {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            // Extension blocked delete? Clear memory
            console.warn(`⚠️ Storage Delete Blocked (${key}). Clearing Memory.`);
            memoryStore.delete(key);
        }
    },
}
