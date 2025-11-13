/**
 * User-agent management for ethical scraping
 */

export const USER_AGENT = 'jkbox-data-collector/0.1.0 (+https://github.com/jkraybill/jkbox; data@jkbox.party)'

export function getUserAgent(): string {
  return USER_AGENT
}
