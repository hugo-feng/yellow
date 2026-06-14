import { supabase } from './supabase'

export interface UserProfile {
  userId: string
  nickname: string
  passwordHash: string
  avatarColor: string
  createdAt: string
}

export interface SyncData {
  books: any[]
  progress: any[]
  readerSettings: any
  theme?: string
  readChapters?: Record<string, number[]> // bookId -> read chapter indices
  inviteCodeActivated?: boolean
  syncedAt: string
}

const USER_KEY = 'yellow-user-profile'
const COLORS = ['#f0c040', '#6495ed', '#e05555', '#4caf84', '#9c27b0', '#ff9800', '#00bcd4', '#e91e63']

function randomId(): string {
  return Math.random().toString(36).substring(2, 8) + Date.now().toString(36)
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(salt + ':' + password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function getStoredProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function storeProfile(profile: UserProfile) {
  localStorage.setItem(USER_KEY, JSON.stringify(profile))
}

export function clearProfile() {
  localStorage.removeItem(USER_KEY)
}

export function clearLocalData() {
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem('reader-settings')
  if ('indexedDB' in window) {
    indexedDB.deleteDatabase('yellow-reader-db')
  }
}

export async function register(nickname: string, password: string): Promise<{ profile?: UserProfile; error?: string }> {
  const userId = nickname.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '') + '-' + randomId()
  const passwordHash = await hashPassword(password, userId)

  const { error } = await supabase.from('yellow_users').insert({
    id: userId,
    nickname,
    password_hash: passwordHash,
    avatar_color: COLORS[Math.floor(Math.random() * COLORS.length)],
    books: [],
    progress: [],
    created_at: new Date().toISOString()
  })

  if (error) {
    if (error.code === '23505') return { error: '昵称已存在' }
    return { error: error.message }
  }

  const profile: UserProfile = { userId, nickname, passwordHash, avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)], createdAt: new Date().toISOString() }
  storeProfile(profile)
  return { profile }
}

export async function login(nickname: string, password: string): Promise<{ profile?: UserProfile; error?: string }> {
  const prefix = nickname.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')

  const { data, error } = await supabase.from('yellow_users')
    .select('*')
    .like('id', `${prefix}-%`)
    .limit(10)

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: '用户不存在' }

  for (const row of data) {
    const passwordHash = await hashPassword(password, row.id)
    if (row.password_hash === passwordHash) {
      const profile: UserProfile = {
        userId: row.id,
        nickname: row.nickname,
        passwordHash: row.password_hash,
        avatarColor: row.avatar_color || '#f0c040',
        createdAt: row.created_at
      }
      storeProfile(profile)
      return { profile }
    }
  }

  return { error: '密码错误' }
}

export async function uploadToCloud(data: SyncData): Promise<{ error?: string }> {
  const profile = getStoredProfile()
  if (!profile) return { error: '未登录' }

  // Merge readChapters and invite code into reader_settings for storage
  const settingsWithRead = {
    ...(data.readerSettings || {}),
    readChapters: data.readChapters || {},
    inviteCodeActivated: data.inviteCodeActivated || false
  }

  const { error } = await supabase.from('yellow_users').update({
    books: data.books,
    progress: data.progress,
    reader_settings: settingsWithRead,
    theme: data.theme || 'light',
    synced_at: new Date().toISOString()
  }).eq('id', profile.userId)

  if (error) return { error: error.message }
  return {}
}

export async function downloadFromCloud(): Promise<{ data?: SyncData; error?: string }> {
  const profile = getStoredProfile()
  if (!profile) return { error: '未登录' }

  const { data, error } = await supabase.from('yellow_users')
    .select('books, progress, reader_settings, theme, synced_at')
    .eq('id', profile.userId)
    .single()

  if (error) return { error: error.message }
  if (!data) return { error: '云端无数据' }

  // Extract readChapters and inviteCodeActivated from reader_settings
  const settings = data.reader_settings || {}
  const { readChapters, inviteCodeActivated, ...readerSettings } = settings

  return {
    data: {
      books: data.books || [],
      progress: data.progress || [],
      readerSettings,
      theme: data.theme || 'light',
      readChapters: readChapters || {},
      inviteCodeActivated: inviteCodeActivated || false,
      syncedAt: data.synced_at
    }
  }
}
