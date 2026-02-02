
/**
 * Custom Storage Adapter for Supabase Auth to use Cookies instead of LocalStorage.
 * This helps persist sessions across tab reloads/discards where LocalStorage might be cleared.
 */
export const CookieStorageAdapter = {
    getItem: (key: string): string | null => {
        const name = `${key}=`
        const decodedCookie = decodeURIComponent(document.cookie)
        const ca = decodedCookie.split(';')
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i]
            while (c.charAt(0) === ' ') {
                c = c.substring(1)
            }
            if (c.indexOf(name) === 0) {
                return c.substring(name.length, c.length)
            }
        }
        return null
    },

    setItem: (key: string, value: string): void => {
        // Set cookie with 1 year expiry, root path, SameSite=Lax (safe for most navigation), and Secure
        const d = new Date()
        d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000))
        const expires = `expires=${d.toUTCString()}`
        const secure = location.protocol === 'https:' ? 'Secure;' : ''
        document.cookie = `${key}=${encodeURIComponent(value)};${expires};path=/;SameSite=Lax;${secure}`
    },

    removeItem: (key: string): void => {
        const secure = location.protocol === 'https:' ? 'Secure;' : ''
        document.cookie = `${key}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax;${secure}`
    }
}
