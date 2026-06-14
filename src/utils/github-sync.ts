import { supabase } from './supabase'

export interface UserProfile {
  userId: string
  nickname: string
  passwordHash: string
  avatarColor: string
  avatarIndex?: number
  createdAt: string
  inviteCodeActivated?: boolean
}

export interface SyncData {
  books: any[]
  progress: any[]
  readerSettings: any
  theme?: string
  readChapters?: Record<string, number[]>
  inviteCodeActivated?: boolean
  autoCheckUpdates?: boolean
  backupFrequency?: number
  searchHistory?: string[]
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

export async function register(nickname: string, password: string, inviteCodeActivated?: boolean): Promise<{ profile?: UserProfile; error?: string }> {
  const userId = nickname.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '') + '-' + randomId()
  const passwordHash = await hashPassword(password, userId)

  const { error } = await supabase.from('yellow_users').insert({
    id: userId,
    nickname,
    password_hash: passwordHash,
    avatar_color: COLORS[Math.floor(Math.random() * COLORS.length)],
    avatar_index: 0,
    books: [],
    progress: [],
    invite_code_activated: inviteCodeActivated || false,
    created_at: new Date().toISOString()
  })

  if (error) {
    if (error.code === '23505') return { error: '昵称已存在' }
    return { error: error.message }
  }

  const profile: UserProfile = { userId, nickname, passwordHash, avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)], createdAt: new Date().toISOString(), inviteCodeActivated: inviteCodeActivated || false }
  storeProfile(profile)
  return { profile }
}

export async function login(nickname: string, password: string): Promise<{ profile?: UserProfile; error?: string }> {
  const { data, error } = await supabase.from('yellow_users')
    .select('*')
    .eq('nickname', nickname)
    .limit(1)

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
        avatarIndex: row.avatar_index ?? 0,
        createdAt: row.created_at,
        inviteCodeActivated: row.invite_code_activated || false
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

  const settingsWithRead = {
    ...(data.readerSettings || {}),
    readChapters: data.readChapters || {},
    autoCheckUpdates: data.autoCheckUpdates ?? true,
    backupFrequency: data.backupFrequency ?? 5,
    searchHistory: data.searchHistory || []
  }

  const updatePayload: Record<string, any> = {
    books: data.books,
    progress: data.progress,
    reader_settings: settingsWithRead,
    theme: data.theme || 'light',
    synced_at: new Date().toISOString()
  }
  if (data.inviteCodeActivated !== undefined) {
    updatePayload.invite_code_activated = data.inviteCodeActivated
  }

  const { error } = await supabase.from('yellow_users').update(updatePayload).eq('id', profile.userId)

  if (error) return { error: error.message }
  return {}
}

export async function downloadFromCloud(): Promise<{ data?: SyncData; error?: string }> {
  const profile = getStoredProfile()
  if (!profile) return { error: '未登录' }

  const { data, error } = await supabase.from('yellow_users')
    .select('books, progress, reader_settings, theme, synced_at, invite_code_activated')
    .eq('id', profile.userId)
    .single()

  if (error) return { error: error.message }
  if (!data) return { error: '云端无数据' }

  const settings = data.reader_settings || {}
  const { readChapters, autoCheckUpdates, backupFrequency, searchHistory, ...readerSettings } = settings

  return {
    data: {
      books: data.books || [],
      progress: data.progress || [],
      readerSettings,
      theme: data.theme || 'light',
      readChapters: readChapters || {},
      inviteCodeActivated: data.invite_code_activated || false,
      autoCheckUpdates: autoCheckUpdates ?? true,
      backupFrequency: backupFrequency ?? 5,
      searchHistory: searchHistory || [],
      syncedAt: data.synced_at
    }
  }
}

export async function changeNickname(userId: string, newNickname: string): Promise<{ error?: string }> {
  const { data: existing } = await supabase.from('yellow_users')
    .select('id')
    .eq('nickname', newNickname)
    .neq('id', userId)
    .limit(1)

  if (existing && existing.length > 0) return { error: '此昵称已被使用' }

  const { error } = await supabase.from('yellow_users')
    .update({ nickname: newNickname })
    .eq('id', userId)

  if (error) return { error: error.message }

  const profile = getStoredProfile()
  if (profile) {
    profile.nickname = newNickname
    storeProfile(profile)
  }
  return {}
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string): Promise<{ error?: string }> {
  const oldHash = await hashPassword(oldPassword, userId)
  const { data, error: fetchError } = await supabase.from('yellow_users')
    .select('password_hash')
    .eq('id', userId)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (!data || data.password_hash !== oldHash) return { error: '原密码错误' }

  const newHash = await hashPassword(newPassword, userId)
  const { error } = await supabase.from('yellow_users')
    .update({ password_hash: newHash })
    .eq('id', userId)

  if (error) return { error: error.message }

  const profile = getStoredProfile()
  if (profile) {
    profile.passwordHash = newHash
    storeProfile(profile)
  }
  return {}
}

export async function updateAvatar(userId: string, avatarIndex: number): Promise<{ error?: string }> {
  const profile = getStoredProfile()
  if (profile) {
    profile.avatarIndex = avatarIndex
    storeProfile(profile)
  }

  const { error } = await supabase.from('yellow_users')
    .update({ avatar_index: avatarIndex })
    .eq('id', userId)

  if (error && !error.message.includes('avatar_index')) return { error: error.message }
  return {}
}
