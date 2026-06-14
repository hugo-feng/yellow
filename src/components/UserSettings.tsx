import { useState, useEffect, useCallback, useRef } from 'react'
import type { Book } from '../types'
import { getStoredProfile, clearLocalData, register, login, uploadToCloud, downloadFromCloud, type UserProfile } from '../utils/github-sync'
import { getAllBooks, saveBook, saveProgress, getProgress } from '../utils/db'

interface Props {
  books: Book[]
  showToast: (msg: string) => void
  onSyncComplete: (books: Book[]) => void
}

const AUTO_BACKUP_INTERVAL = 5 * 60 * 1000

export default function UserSettings({ books, showToast, onSyncComplete }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(getStoredProfile)
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'idle' | 'register' | 'login'>('idle')
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
    const { data, error } = await downloadFromCloud()
    if (error || !data) return false
    for (const book of data.books) await saveBook(book)
    for (const p of data.progress) await saveProgress(p)
    if (data.readerSettings) localStorage.setItem('reader-settings', JSON.stringify(data.readerSettings))
    if (data.theme) {
      localStorage.setItem('theme', data.theme)
      document.documentElement.className = `theme-${data.theme}`
    }
    // Restore readChapters
    if (data.readChapters) {
      for (const [bookId, chapters] of Object.entries(data.readChapters)) {
        localStorage.setItem(`read-${bookId}`, JSON.stringify(chapters))
      }
    }
    onSyncComplete(await getAllBooks())
    return true
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
    const { profile: p, error } = await register(name, password)
    setLoading(false)
    if (error) { showToast(error); return }
    if (p) {
      setProfile(p); setNickname(''); setPassword(''); setMode('idle')
      showToast(`欢迎, ${p.nickname}!`)
    }
  }, [nickname, password, showToast])

  const handleLogin = useCallback(async () => {
    const name = nickname.trim()
    if (!name || !password) { showToast('请输入昵称和密码'); return }
    setLoading(true)
    const { profile: p, error } = await login(name, password)
    if (error) { setLoading(false); showToast(error); return }
    if (p) {
      setProfile(p); setNickname(''); setPassword(''); setMode('idle')
      showToast(`欢迎回来, ${p.nickname}!`)
      const restored = await doRestore()
      setLoading(false)
      if (restored) showToast('已从云端恢复数据')
    }
  }, [nickname, password, showToast, doRestore])

  const handleLogout = useCallback(async () => {
    stopAutoBackup()
    await doBackup(true)
    clearLocalData()
    setProfile(null)
    setLastBackup(null)
    window.location.reload()
  }, [stopAutoBackup, doBackup])

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
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setMode('idle'); setNickname(''); setPassword('') }}>取消</button>
              <button className="btn btn-primary" style={{ flex: 1, opacity: loading ? 0.6 : 1 }} onClick={mode === 'register' ? handleRegister : handleLogin} disabled={loading}>
                {loading ? '处理中...' : mode === 'register' ? '注册' : '登录'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
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
        <button style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer' }} onClick={handleLogout}>退出</button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1, opacity: loading ? 0.6 : 1 }} onClick={() => doBackup(false)} disabled={loading}>
          {loading ? '备份中...' : '手动备份'}
        </button>
        <button className="btn btn-secondary" style={{ flex: 1, opacity: loading ? 0.6 : 1 }} onClick={async () => { setLoading(true); const ok = await doRestore(); setLoading(false); showToast(ok ? '已恢复' : '恢复失败') }} disabled={loading}>
          {loading ? '恢复中...' : '从云端恢复'}
        </button>
      </div>
    </div>
  )
}
