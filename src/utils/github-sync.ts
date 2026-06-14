export interface UserProfile {
  userId: string
  nickname: string
  avatarColor: string
  createdAt: string
}

const USER_KEY = 'yellow-user-profile'
const COLORS = ['#f0c040', '#6495ed', '#e05555', '#4caf84', '#9c27b0', '#ff9800', '#00bcd4', '#e91e63']

function randomId(): string {
  return Math.random().toString(36).substring(2, 8) + Date.now().toString(36)
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

export function createProfile(nickname: string): UserProfile {
  const profile: UserProfile = {
    userId: nickname.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '') + '-' + randomId(),
    nickname,
    avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
    createdAt: new Date().toISOString()
  }
  storeProfile(profile)
  return profile
}
