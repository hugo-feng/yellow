const INVITE_CODE = '1887415157'
const STORAGE_KEY = 'yellow-invite-code'

export function hasInviteCode(): boolean {
  return localStorage.getItem(STORAGE_KEY) === INVITE_CODE
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
