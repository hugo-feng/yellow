export interface GitHubUser {
  login: string
  avatar_url: string
  name: string
}

export interface SyncData {
  books: any[]
  progress: any[]
  readerSettings: any
  syncedAt: string
}

const GIST_FILENAME = 'yellow-reader-data.json'
const GIST_DESCRIPTION = 'Yellow Reader - User Data Sync'
const TOKEN_KEY = 'yellow-github-token'
const USER_KEY = 'yellow-github-user'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): GitHubUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function storeAuth(token: string, user: GitHubUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function isLoggedIn(): boolean {
  return !!getStoredToken()
}

async function ghFetch(url: string, token: string, options: RequestInit = {}): Promise<any> {
  const resp = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers
    }
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.message || `GitHub API ${resp.status}`)
  }
  return resp.json()
}

export async function verifyToken(token: string): Promise<GitHubUser> {
  const user = await ghFetch('https://api.github.com/user', token)
  return { login: user.login, avatar_url: user.avatar_url, name: user.name || user.login }
}

async function findGist(token: string): Promise<string | null> {
  const gists = await ghFetch('https://api.github.com/gists', token)
  const gist = gists.find((g: any) => g.description === GIST_DESCRIPTION && g.files[GIST_FILENAME])
  return gist?.id || null
}

export async function syncToGitHub(data: SyncData): Promise<void> {
  const token = getStoredToken()
  if (!token) throw new Error('未登录')

  const content = JSON.stringify(data, null, 2)
  const existingGistId = await findGist(token)

  if (existingGistId) {
    await ghFetch(`https://api.github.com/gists/${existingGistId}`, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: { [GIST_FILENAME]: { content } }
      })
    })
  } else {
    await ghFetch('https://api.github.com/gists', token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: GIST_DESCRIPTION,
        public: false,
        files: { [GIST_FILENAME]: { content } }
      })
    })
  }
}

export async function syncFromGitHub(): Promise<SyncData | null> {
  const token = getStoredToken()
  if (!token) return null

  const gistId = await findGist(token)
  if (!gistId) return null

  const gist = await ghFetch(`https://api.github.com/gists/${gistId}`, token)
  const file = gist.files[GIST_FILENAME]
  if (!file?.content) return null

  try {
    return JSON.parse(file.content)
  } catch { return null }
}
