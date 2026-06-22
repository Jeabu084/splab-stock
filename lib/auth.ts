// lib/auth.ts — Helper functions สำหรับ authentication ระบบ SPLABSTOCK

export type UserRole = 'admin' | 'user' | 'viewer'

export interface AppUser {
  id: number
  username: string
  full_name: string
  role: UserRole
}

const SESSION_KEY = 'splabstock_user'

// SHA-256 hash
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// บันทึก session
export function saveSession(user: AppUser) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

// ดึง session
export function getSession(): AppUser | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as AppUser }
  catch { return null }
}

// ลบ session (logout)
export function clearSession() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(SESSION_KEY)
}

// ตรวจสอบสิทธิ์เข้าถึงแต่ละ tab
export function canAccess(role: UserRole, tabId: string): boolean {
  const rules: Record<string, UserRole[]> = {
    home:     ['admin', 'user'],
    overview: ['admin', 'user', 'viewer'],
    usage:    ['admin', 'user', 'viewer'],
    items:    ['admin', 'user', 'viewer'],
    history:  ['admin', 'user', 'viewer'],
    vendor:   ['admin'],
    settings: ['admin'],
  }
  return (rules[tabId] || []).includes(role)
}
