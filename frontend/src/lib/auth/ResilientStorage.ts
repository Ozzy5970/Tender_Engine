import type { SupportedStorage } from '@supabase/supabase-js'

/**
 * ResilientStorage acts as a "Circuit Breaker" for browser storage.
 * 
 * PROBLEM:
 * Browser extensions (AdBlock, Privacy Badger, etc.) often block or interfere with
 * `localStorage` access, throwing `SecurityError` or `AccessDenied`.
 * When this happens, a standard app crashes or logs the user out.
 * 
 * SOLUTION:
 * This adapter attempts to write to `localStorage`. If it fails (throws),
 * it automatically switches to an in-memory `Map` (RAM) for the current session.
 * 
 * SAFETY:
 * - This ensures the user stays logged in for their current session even in hostile environments.
 * - It does NOT leak tokens. Memory storage is isolated to the current tab.
 * - It is strictly typed to match Supabase's expected interface.
 */
export class ResilientStorage implements SupportedStorage {
    private memoryStore: Map<string, string>
    private isLocalStorageBlocked: boolean

    constructor() {
        this.memoryStore = new Map()
        this.isLocalStorageBlocked = false

        // Proactive check: Test if we can write to disk immediately upon boot.
        try {
            const testKey = '__authtest__'
            window.localStorage.setItem(testKey, '1')
            window.localStorage.removeItem(testKey)
        } catch (e) {
            console.warn('⚠️ [ResilientStorage] LocalStorage is blocked by browser/extensions. Falling back to RAM.', e)
            this.isLocalStorageBlocked = true
        }
    }

    getItem(key: string): string | null {
        // 1. Try Memory first (Fastest / Truth if fell back)
        if (this.memoryStore.has(key)) {
            return this.memoryStore.get(key) || null
        }

        // 2. If disk is known bad, don't try (avoid console noise)
        if (this.isLocalStorageBlocked) {
            return null
        }

        // 3. Try Disk
        try {
            return window.localStorage.getItem(key)
        } catch (e) {
            console.warn(`⚠️ [ResilientStorage] Read error for key "${key}".`, e)
            // If disk read fails, we can't do much recovering of *old* data, 
            // but we mark it blocked for future writes.
            this.isLocalStorageBlocked = true
            return null
        }
    }

    setItem(key: string, value: string): void {
        // Always write to memory (Reliability)
        this.memoryStore.set(key, value)

        if (this.isLocalStorageBlocked) return

        try {
            window.localStorage.setItem(key, value)
        } catch (e) {
            console.warn(`⚠️ [ResilientStorage] Write error for key "${key}". Switching to RAM.`, e)
            this.isLocalStorageBlocked = true
        }
    }

    removeItem(key: string): void {
        this.memoryStore.delete(key)

        if (this.isLocalStorageBlocked) return

        try {
            window.localStorage.removeItem(key)
        } catch (e) {
            console.warn(`⚠️ [ResilientStorage] Delete error for key "${key}". Ignoring.`, e)
            // Don't necessarily block future actions just because delete failed, 
            // but usually implies blocked access.
        }
    }
}

export const resilientStorage = new ResilientStorage()
