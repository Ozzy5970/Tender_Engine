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
            return localStorage.getItem(key);
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
