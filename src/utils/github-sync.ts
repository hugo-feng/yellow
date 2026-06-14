declare const __GH_TOKEN__: string

const GH_TOKEN = typeof __GH_TOKEN__ !== 'undefined' ? __GH_TOKEN__ : ''
const REPO = 'hugo-feng/yellow'
const BRANCH = 'gh-pages'
const DATA_DIR = 'users'

export interface UserProfile {
  userId: string
  nickname: string
  passwordHash: string
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
  const msg = salt + ':' + password
  const encoder = new TextEncoder()
  const data = encoder.encode(msg)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
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

export function isRegistered(): boolean {
  return !!getStoredProfile()
}

export async function createProfile(nickname: string, password: string): Promise<UserProfile> {
  const userId = nickname.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + randomId()
  const passwordHash = await hashPassword(password, userId)
  const profile: UserProfile = {
    userId,
    nickname,
    passwordHash,
    avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
    createdAt: new Date().toISOString()
  }
  storeProfile(profile)
  return profile
}

export async function verifyLogin(nickname: string, password: string): Promise<UserProfile | null> {
  const userIdPrefix = nickname.toLowerCase().replace(/[^a-z0-9]/g, '')
  const url = `https://api.github.com/repos/${REPO}/contents/${DATA_DIR}?ref=${BRANCH}`
  try {
    const files = await xhrFetch(url)
    if (!Array.isArray(files)) return null

    for (const file of files) {
      if (!file.name.startsWith(userIdPrefix + '-') || !file.name.endsWith('.json')) continue
      const fileUserId = file.name.replace('.json', '')
      const data = await downloadData(fileUserId)
      if (!data?.profile) continue

      const passwordHash = await hashPassword(password, fileUserId)
      if (data.profile.passwordHash === passwordHash) {
        storeProfile(data.profile)
        return data.profile
      }
    }
    return null
  } catch {
    return null
  }
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
      } else {
        reject(new Error('HTTP ' + xhr.status))
      }
    }
    xhr.onerror = () => reject(new Error('网络错误'))
    xhr.ontimeout = () => reject(new Error('超时'))
    xhr.send(options.body || null)
  })
}

export async function uploadData(data: SyncData): Promise<void> {
  if (!GH_TOKEN) throw new Error('同步服务未配置')

  const filePath = `${DATA_DIR}/${data.profile.userId}.json`
  const content = JSON.stringify(data, null, 2)
  const encoded = btoa(unescape(encodeURIComponent(content)))

  try {
    await xhrFetch(`https://api.github.com/repos/${REPO}/contents/${filePath}`, {
      method: 'PUT',
      token: GH_TOKEN,
      body: JSON.stringify({
        message: `sync: ${data.profile.nickname} data`,
        content: encoded,
        branch: BRANCH
      })
    })
  } catch (e) {
    throw new Error('上传失败: ' + (e as Error).message)
  }
}

export async function downloadData(userId: string): Promise<SyncData | null> {
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${DATA_DIR}/${userId}.json?t=${Date.now()}`
  try {
    const data = await xhrFetch(url)
    return data as SyncData
  } catch {
    return null
  }
}
