import { getStoredProfile, type UserProfile } from './github-sync'

const INVITE_CODE = '1887415157'
const STORAGE_KEY = 'yellow-invite-code'

export function hasInviteCode(): boolean {
  if (localStorage.getItem(STORAGE_KEY) === INVITE_CODE) return true
  const profile = getStoredProfile()
  return !!profile?.inviteCodeActivated
}

export function hasInviteCodeFromProfile(profile: UserProfile | null): boolean {
  return !!profile?.inviteCodeActivated
}

export function getInviteCode(): string {
  return localStorage.getItem(STORAGE_KEY) || ''
}

export function setInviteCode(code: string) {
  if (code.trim()) {
    localStorage.setItem(STORAGE_KEY, code.trim())
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function isInviteCodeValid(code: string): boolean {
  return code.trim() === INVITE_CODE
}
