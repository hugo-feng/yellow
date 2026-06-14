const REPO = 'hugo-feng/yellow'
const BRANCH = 'gh-pages'
const DATA_DIR = 'users'

export interface UserProfile {
  userId: string
  nickname: string
  passwordHash: string
  syncToken: string
  avatarColor: string
  createdAt: string
}

export interface SyncData {
  profile: UserProfile
  books: any[]
  progress: any[]
  readerSettings: any
  syncedAt: string
}

const USER_KEY = 'yellow-user-profile'
const COLORS = ['#f0c040', '#6495ed', '#e05555', '#4caf84', '#9c27b0', '#ff9800', '#00bcd4', '#e91e63']

function randomId(): string {
  return Math.random().toString(36).substring(2, 8) + Date.now().toString(36)
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(salt + ':' + password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
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

export async function createProfile(nickname: string, password: string, syncToken: string): Promise<UserProfile> {
  const userId = nickname.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + randomId()
  const passwordHash = await hashPassword(password, userId)
  const profile: UserProfile = {
    userId, nickname, passwordHash, syncToken,
    avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
    createdAt: new Date().toISOString()
  }
  storeProfile(profile)
  return profile
}

export async function verifyLogin(nickname: string, password: string, syncToken: string): Promise<UserProfile | null> {
  const userIdPrefix = nickname.toLowerCase().replace(/[^a-z0-9]/g, '')
  try {
    const files = await xhrFetch(`https://api.github.com/repos/${REPO}/contents/${DATA_DIR}?ref=${BRANCH}`, { token: syncToken })
    if (!Array.isArray(files)) return null
    for (const file of files) {
      if (!file.name.startsWith(userIdPrefix + '-') || !file.name.endsWith('.json')) continue
      const fileUserId = file.name.replace('.json', '')
      const data = await downloadData(fileUserId, syncToken)
      if (!data?.profile) continue
      const passwordHash = await hashPassword(password, fileUserId)
      if (data.profile.passwordHash === passwordHash) {
        const fullProfile = { ...data.profile, syncToken }
        storeProfile(fullProfile)
        return fullProfile
      }
    }
    return null
  } catch { return null }
}

function xhrFetch(url: string, options: { method?: string; body?: string; token?: string; timeout?: number } = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(options.method || 'GET', url, true)
    xhr.timeout = options.timeout || 10000
    xhr.setRequestHeader('Accept', 'application/vnd.github+json')
    if (options.token) xhr.setRequestHeader('Authorization', 'Bearer ' + options.token)
    if (options.body) xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)) } catch { resolve(xhr.responseText) }
      } else { reject(new Error('HTTP ' + xhr.status)) }
    }
    xhr.onerror = () => reject(new Error('网络错误'))
    xhr.ontimeout = () => reject(new Error('超时'))
    xhr.send(options.body || null)
  })
}

export async function uploadData(data: SyncData): Promise<void> {
  const token = data.profile.syncToken
  if (!token) throw new Error('同步密钥无效')
  const filePath = `${DATA_DIR}/${data.profile.userId}.json`
  const content = JSON.stringify(data, null, 2)
  const encoded = btoa(unescape(encodeURIComponent(content)))
  try {
    await xhrFetch(`https://api.github.com/repos/${REPO}/contents/${filePath}`, {
      method: 'PUT', token,
      body: JSON.stringify({ message: `sync: ${data.profile.nickname}`, content: encoded, branch: BRANCH })
    })
  } catch (e) { throw new Error('上传失败: ' + (e as Error).message) }
}

export async function downloadData(userId: string, token?: string): Promise<SyncData | null> {
  const profile = getStoredProfile()
  const t = token || profile?.syncToken
  if (!t) return null
  try {
    const files = await xhrFetch(`https://api.github.com/repos/${REPO}/contents/${DATA_DIR}/${userId}.json?ref=${BRANCH}`, { token: t })
    if (files.content) {
      const decoded = decodeURIComponent(escape(atob(files.content.replace(/\s/g, ''))))
      return JSON.parse(decoded)
    }
    return null
  } catch { return null }
}
