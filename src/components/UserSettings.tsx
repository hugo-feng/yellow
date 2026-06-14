import { useState, useEffect, useCallback, useRef } from 'react'
import type { Book } from '../types'
import { getStoredProfile, clearLocalData, register, login, uploadToCloud, downloadFromCloud, type UserProfile } from '../utils/github-sync'
import { getAllBooks, saveBook, saveProgress, getProgress } from '../utils/db'
import { hasInviteCode, isInviteCodeValid, setInviteCode as saveInviteCodeToStorage } from '../utils/invite'

interface Props {
  books: Book[]
  showToast: (msg: string) => void
  onSyncComplete: (books: Book[]) => void
  onProfileChange?: (profile: UserProfile | null) => void
}

const AUTO_BACKUP_INTERVAL = 5 * 60 * 1000

export default function UserSettings({ books, showToast, onSyncComplete, onProfileChange }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(getStoredProfile)
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'idle' | 'register' | 'login'>('idle')
  const [showProfile, setShowProfile] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const backupTimer = useRef<ReturnType<typeof setInterval>>()

  const doBackup = useCallback(async (silent = false) => {
    const p = getStoredProfile()
    if (!p) return
    try {
      const allBooks = await getAllBooks()
      const progressList: any[] = []
      for (const book of allBooks) {
        const prog = await getProgress(book.id)
        if (prog) progressList.push(prog)
      }
      const settings = localStorage.getItem('reader-settings')
      const theme = localStorage.getItem('theme') || 'light'
      
      // Collect readChapters from localStorage
      const readChapters: Record<string, number[]> = {}
      for (const book of allBooks) {
        try {
          const stored = localStorage.getItem(`read-${book.id}`)
          if (stored) readChapters[book.id] = JSON.parse(stored)
        } catch {}
      }

      const { error } = await uploadToCloud({
        books: allBooks, progress: progressList,
        readerSettings: settings ? JSON.parse(settings) : null,
        theme, readChapters,
        inviteCodeActivated: hasInviteCode(),
        syncedAt: new Date().toISOString()
      })
      if (!error) {
        const now = new Date().toLocaleTimeString()
        setLastBackup(now)
        if (!silent) showToast('已备份到云端')
      } else if (!silent) {
        showToast('备份失败: ' + error)
      }
    } catch (e) {
      if (!silent) showToast('备份失败')
    }
  }, [showToast])

  const doRestore = useCallback(async () => {
    try {
      const { data, error } = await downloadFromCloud()
      if (error) { console.error('[Restore] download error:', error); return false }
      if (!data) { console.error('[Restore] no data'); return false }
      
      let restoredCount = 0
      for (const book of data.books) {
        try {
          if (book && book.id) { await saveBook(book); restoredCount++ }
        } catch (e) { console.error('[Restore] saveBook error:', e) }
      }
      for (const p of data.progress) {
        try { if (p && p.bookId) await saveProgress(p) } catch (e) { console.error('[Restore] saveProgress error:', e) }
      }
      if (data.readerSettings) localStorage.setItem('reader-settings', JSON.stringify(data.readerSettings))
      if (data.theme) {
        localStorage.setItem('theme', data.theme)
        document.documentElement.className = `theme-${data.theme}`
      }
      if (data.readChapters) {
        for (const [bookId, chapters] of Object.entries(data.readChapters)) {
          localStorage.setItem(`read-${bookId}`, JSON.stringify(chapters))
        }
      }
      if (data.inviteCodeActivated) {
        saveInviteCodeToStorage('1887415157')
      }
      console.log(`[Restore] restored ${restoredCount}/${data.books.length} books`)
      onSyncComplete(await getAllBooks())
      return true
    } catch (e) { console.error('[Restore] exception:', e); return false }
  }, [onSyncComplete])

  const startAutoBackup = useCallback(() => {
    if (backupTimer.current) clearInterval(backupTimer.current)
    backupTimer.current = setInterval(() => doBackup(true), AUTO_BACKUP_INTERVAL)
  }, [doBackup])

  const stopAutoBackup = useCallback(() => {
    if (backupTimer.current) { clearInterval(backupTimer.current); backupTimer.current = undefined }
  }, [])

  useEffect(() => {
    if (profile) startAutoBackup()
    return () => stopAutoBackup()
  }, [profile])

  const handleRegister = useCallback(async () => {
    const name = nickname.trim()
    if (!name) { showToast('请输入昵称'); return }
    if (name.length < 2 || name.length > 12) { showToast('昵称2-12个字符'); return }
    if (password.length < 4) { showToast('密码至少4位'); return }
    setLoading(true)
    const validInvite = inviteCode.trim() && isInviteCodeValid(inviteCode.trim())
    const { profile: p, error } = await register(name, password, !!validInvite)
    setLoading(false)
    if (error) { showToast(error); return }
    if (p) {
      setProfile(p); setNickname(''); setPassword(''); setMode('idle')
      if (validInvite) saveInviteCodeToStorage(inviteCode.trim())
      onProfileChange?.(p)
      showToast(`欢迎, ${p.nickname}!`)
    }
  }, [nickname, password, inviteCode, showToast, onProfileChange])

  const handleLogin = useCallback(async () => {
    const name = nickname.trim()
    if (!name || !password) { showToast('请输入昵称和密码'); return }
    setLoading(true)
    const { profile: p, error } = await login(name, password)
    if (error) { setLoading(false); showToast(error); return }
    if (p) {
      setProfile(p); setNickname(''); setPassword(''); setMode('idle')
      if (p.inviteCodeActivated) saveInviteCodeToStorage('1887415157')
      onProfileChange?.(p)
      showToast(`欢迎回来, ${p.nickname}!`)
      const restored = await doRestore()
      setLoading(false)
      if (restored) showToast('已从云端恢复数据')
    }
  }, [nickname, password, showToast, doRestore, onProfileChange])

  const handleLogout = useCallback(async () => {
    stopAutoBackup()
    await doBackup(true)
    clearLocalData()
    setProfile(null)
    setLastBackup(null)
    onProfileChange?.(null)
    window.location.reload()
  }, [stopAutoBackup, doBackup, onProfileChange])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-primary)',
    color: 'var(--text-primary)', fontSize: 14, marginBottom: 8,
    outline: 'none', boxSizing: 'border-box'
  }

  if (!profile) {
    return (
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>未登录</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>登录后自动同步书架到云端</div>
          </div>
        </div>
        {mode === 'idle' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setMode('register')}>注册</button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setMode('login')}>登录</button>
          </div>
        )}
        {(mode === 'register' || mode === 'login') && (
          <div>
            <input type="text" placeholder="昵称（2-12个字符）" value={nickname}
              onChange={e => setNickname(e.target.value)} maxLength={12} style={inputStyle} autoFocus />
            <input type="password" placeholder="密码（至少4位）" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (mode === 'register' ? handleRegister() : handleLogin())}
              style={inputStyle} />
            {mode === 'register' && (
              <input type="text" placeholder="邀请码（选填）" value={inviteCode}
                onChange={e => setInviteCode(e.target.value)} maxLength={20} style={inputStyle} />
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setMode('idle'); setNickname(''); setPassword(''); setInviteCode('') }}>取消</button>
              <button className="btn btn-primary" style={{ flex: 1, opacity: loading ? 0.6 : 1 }} onClick={mode === 'register' ? handleRegister : handleLogin} disabled={loading}>
                {loading ? '处理中...' : mode === 'register' ? '注册' : '登录'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (showProfile) {
    return (
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary)' }} onClick={() => setShowProfile(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span style={{ fontWeight: 600, fontSize: 14 }}>个人资料</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 32, background: profile.avatarColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 24
          }}>
            {profile.nickname.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.nickname}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID: {profile.userId}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>注册时间: {new Date(profile.createdAt).toLocaleDateString()}</div>
          {profile.inviteCodeActivated && (
            <div style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              邀请码已激活
            </div>
          )}
        </div>
        <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleLogout}>退出登录</button>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setShowProfile(true)}>
        <div style={{
          width: 40, height: 40, borderRadius: 20, background: profile.avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 16
        }}>
          {profile.nickname.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{profile.nickname}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {lastBackup ? `上次备份: ${lastBackup}` : '每5分钟自动备份'}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><polyline points="9 18 15 12 9 6" /></svg>
      </div>
    </div>
  )
}
