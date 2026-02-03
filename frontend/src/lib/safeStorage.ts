/**
 * SafeStorage Adapter for Supabase
 * 
 * Purpose: "Cushion the blow" when extensions (like MetaMask/Lockdown) block localStorage.
 * Strategy: Try localStorage. If it throws (SecurityError/AccessDenied), fall back to COOKIES.
 * Why Cookies? Unlike RAM, Cookies persist across page reloads.
 * Result: User stays logged in even if the browser/extension hates localStorage.
 */

// Simple Cookie Helpers
const CookieHelper = {
    set: (name: string, value: string, days = 365) => {
        const d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = "expires=" + d.toUTCString();
        // Secure, SameSite=Lax for best SPA compatibility
        document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/;SameSite=Lax;Secure`;
    },
    get: (name: string): string | null => {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
        return null;
    },
    remove: (name: string) => {
        document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
    }
}

export const resultientStorage = {
    getItem: (key: string): string | null => {
        try {
            // Priority 1: Try LocalStorage (Best/Fastest)
            return localStorage.getItem(key);
        } catch (error) {
            console.warn("⚠️ localStorage blocked. Using COOKIE fallback for read:", key);
            // Priority 2: Fallback to Cookie
            return CookieHelper.get(key);
        }
    },
    setItem: (key: string, value: string): void => {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.warn("⚠️ localStorage blocked. Using COOKIE fallback for write:", key);
            CookieHelper.set(key, value);
        }
    },
    removeItem: (key: string): void => {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn("⚠️ localStorage blocked. Using COOKIE fallback for delete:", key);
            CookieHelper.remove(key);
        }
    },
};
