/**
 * Cookie utility functions
 */

const NICKNAME_COOKIE = 'jkbox_nickname'
const EXPIRY_DAYS = 90

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=')
    if (key === name) {
      return decodeURIComponent(value)
    }
  }
  return null
}

/**
 * Set a cookie with optional expiry
 */
export function setCookie(name: string, value: string, days?: number): void {
  let expires = ''
  if (days) {
    const date = new Date()
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
    expires = `; expires=${date.toUTCString()}`
  }
  document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Lax`
}

/**
 * Delete a cookie
 */
export function deleteCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
}

/**
 * Get saved nickname from cookie
 */
export function getSavedNickname(): string | null {
  return getCookie(NICKNAME_COOKIE)
}

/**
 * Save nickname to cookie (90-day expiration)
 */
export function saveNickname(nickname: string): void {
  setCookie(NICKNAME_COOKIE, nickname, EXPIRY_DAYS)
}

/**
 * Clear saved nickname
 */
export function clearNickname(): void {
  deleteCookie(NICKNAME_COOKIE)
}
