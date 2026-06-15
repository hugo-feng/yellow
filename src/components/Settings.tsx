import { useState, useEffect, useCallback } from 'react'
import type { Book } from '../types'
import { getStorageInfo, clearCache } from '../utils/db'
import { useTheme } from '../hooks/useTheme'
import { getStoredProfile, clearLocalData, register, login, uploadToCloud, downloadFromCloud, type UserProfile } from '../utils/github-sync'
import { getAllBooks, saveBook, saveProgress, getProgress } from '../utils/db'
import { hasInviteCode, isInviteCodeValid, setInviteCode as saveInviteCodeToStorage } from '../utils/invite'

const AVATARS = [
  '🐉','🦅','🐺','🦁','🐯','🦈','🐙','🦂','🦖','👻',
  '🤖','👽','🦊','🐲','🦋','🦇','🕷️','🐍','🐊','🐢',
  '🦎','🦑','🦐','🦀','🐬','🐳','🐋','🐆','🐅','🐃',
  '🦌','🐪','🐫','🦙','🦒','🐘','🦏','🦛','🐓','🦃',
  '🦅','🐧','🦚','🦜','🦢','🦩','🐝','🐛','🐌','🐜',
  '🐞','🦗','🪲','🪳','🦟','🪰','🪱','🦠','💀','🎃'
]

interface Props {
  books: Book[]
  showToast: (msg: string) => void
  onOpenAbout: () => void
  cacheTask?: { bookId: string; title: string; progress: number; current: number; total: number } | null
  onOpenCacheManager?: () => void
  onSyncComplete?: (books: Book[]) => void
  onOpenProfile?: () => void
}

export default function Settings({ books, showToast, onOpenAbout, cacheTask, onOpenCacheManager, onSyncComplete, onOpenProfile }: Props) {
  const { theme, toggle: toggleTheme } = useTheme()
  const [autoCheck, setAutoCheck] = useState(() => localStorage.getItem('ota-auto-check') !== 'off')
  const [storageInfo, setStorageInfo] = useState({ books: 0, chapters: 0, size: '0 B' })
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(getStoredProfile)
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMode, setAuthMode] = useState<'idle' | 'register' | 'login'>('idle')
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [showCloudSheet, setShowCloudSheet] = useState(false)
  const [backupFrequency, setBackupFrequency] = useState(() => {
    const saved = localStorage.getItem('yellow-backup-frequency')
    return saved ? parseInt(saved, 10) : 5
  })
  const [showBackupFreqSheet, setShowBackupFreqSheet] = useState(false)

  useEffect(() => { getStorageInfo().then(setStorageInfo) }, [books])

  const toggleAutoCheck = () => {
    const next = !autoCheck
    setAutoCheck(next)
    localStorage.setItem('ota-auto-check', next ? 'on' : 'off')
    showToast(next ? '启动时自动检查更新' : '已关闭自动检查更新')
  }

  const changeBackupFreq = (mins: number) => {
    setBackupFrequency(mins)
    localStorage.setItem('yellow-backup-frequency', String(mins))
    setShowBackupFreqSheet(false)
    showToast(`备份频率已改为 ${mins} 分钟`)
  }

  const handleClearAll = async () => {
    await clearCache()
    localStorage.clear()
    showToast('已清除所有数据')
    setShowClearConfirm(false)
    setTimeout(() => window.location.reload(), 500)
  }

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
      const thm = localStorage.getItem('theme') || 'light'
      const readChapters: Record<string, number[]> = {}
      for (const book of allBooks) {
        try {
          const stored = localStorage.getItem(`read-${book.id}`)
          if (stored) readChapters[book.id] = JSON.parse(stored)
        } catch {}
      }
      let searchHistory: string[] = []
      try { searchHistory = JSON.parse(localStorage.getItem('yellow-search-history') || '[]') } catch {}
      const { error } = await uploadToCloud({
        books: allBooks, progress: progressList,
        readerSettings: settings ? JSON.parse(settings) : null,
        readChapters,
        autoCheckUpdates: localStorage.getItem('ota-auto-check') !== 'off',
        backupFrequency: parseInt(localStorage.getItem('yellow-backup-frequency') || '5', 10),
        searchHistory,
        syncedAt: new Date().toISOString()
      })
      if (!error) {
        const now = new Date().toLocaleTimeString()
        setLastBackup(now)
        if (!silent) showToast('已备份到云端')
      } else if (!silent) {
        showToast('备份失败: ' + error)
      }
    } catch {
      if (!silent) showToast('备份失败')
    }
  }, [showToast])

  useEffect(() => {
    if (!profile) return
    const mins = parseInt(localStorage.getItem('yellow-backup-frequency') || '5', 10)
    const timer = setInterval(() => doBackup(true), mins * 60 * 1000)
    return () => clearInterval(timer)
  }, [profile, doBackup])

  const doRestore = useCallback(async () => {
    try {
      const { data, error } = await downloadFromCloud()
      if (error) { return false }
      if (!data) { return false }
      for (const book of data.books) {
        try { if (book && book.id) await saveBook(book) } catch {}
      }
      for (const p of data.progress) {
        try { if (p && p.bookId) await saveProgress(p) } catch {}
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
      if (data.autoCheckUpdates !== undefined) {
        localStorage.setItem('ota-auto-check', data.autoCheckUpdates ? 'on' : 'off')
        setAutoCheck(data.autoCheckUpdates)
      }
      if (data.backupFrequency) {
        localStorage.setItem('yellow-backup-frequency', String(data.backupFrequency))
        setBackupFrequency(data.backupFrequency)
      }
      if (data.searchHistory && data.searchHistory.length > 0) {
        localStorage.setItem('yellow-search-history', JSON.stringify(data.searchHistory))
      }
      onSyncComplete?.(await getAllBooks())
      return true
    } catch { return false }
  }, [onSyncComplete])

  const handleRegister = useCallback(async () => {
    const name = nickname.trim()
    if (!name) { showToast('请输入昵称'); return }
    if (name.length < 2 || name.length > 12) { showToast('昵称2-12个字符'); return }
    if (password.length < 4) { showToast('密码至少4位'); return }
    setAuthLoading(true)
    const validInvite = inviteCode.trim() && isInviteCodeValid(inviteCode.trim())
    const { profile: p, error } = await register(name, password, !!validInvite)
    setAuthLoading(false)
    if (error) { showToast(error); return }
    if (p) {
      setProfile(p); setNickname(''); setPassword(''); setAuthMode('idle')
      if (validInvite) saveInviteCodeToStorage(inviteCode.trim())
      showToast(`欢迎, ${p.nickname}!`)
    }
  }, [nickname, password, inviteCode, showToast])

  const handleLogin = useCallback(async () => {
    const name = nickname.trim()
    if (!name || !password) { showToast('请输入昵称和密码'); return }
    setAuthLoading(true)
    const { profile: p, error } = await login(name, password)
    if (error) { setAuthLoading(false); showToast(error); return }
    if (p) {
      setProfile(p); setNickname(''); setPassword(''); setAuthMode('idle')
      if (p.inviteCodeActivated) saveInviteCodeToStorage('1887415157')
      showToast(`欢迎回来, ${p.nickname}!`)
      const restored = await doRestore()
      setAuthLoading(false)
      if (restored) showToast('已从云端恢复数据')
    }
  }, [nickname, password, showToast, doRestore])

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const handleLogout = useCallback(async () => {
    setShowLogoutConfirm(true)
  }, [])

  const confirmLogout = useCallback(async () => {
    setShowLogoutConfirm(false)
    await doBackup(true)
    clearLocalData()
    setProfile(null)
    setLastBackup(null)
    window.location.reload()
  }, [doBackup])

  const entryStyle: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', marginBottom: 2, cursor: 'pointer', background: 'var(--bg-card)',
    border: 'none', color: 'var(--text-primary)', fontSize: 14
  }
  const firstEntryStyle: React.CSSProperties = { ...entryStyle, borderRadius: 'var(--radius) var(--radius) 0 0' }
  const lastEntryStyle: React.CSSProperties = { ...entryStyle, borderRadius: '0 0 var(--radius) var(--radius)', marginBottom: 12 }
  const midEntryStyle: React.CSSProperties = { ...entryStyle, borderTop: '1px solid var(--border)' }

  const EntryIcon = ({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) => (
    <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{children}</div>
  )
  const Chevron = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><polyline points="9 18 15 12 9 6" /></svg>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-primary)',
    color: 'var(--text-primary)', fontSize: 14, marginBottom: 8,
    outline: 'none', boxSizing: 'border-box'
  }

  return (
    <div style={{ padding: 16 }}>
      {/* 用户账号区域 */}
      {!profile ? (
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
          {authMode === 'idle' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setAuthMode('register')}>注册</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAuthMode('login')}>登录</button>
            </div>
          )}
          {(authMode === 'register' || authMode === 'login') && (
            <div>
              <input type="text" placeholder="昵称（2-12个字符）" value={nickname}
                onChange={e => setNickname(e.target.value)} maxLength={12} style={inputStyle} autoFocus />
              <input type="password" placeholder="密码（至少4位）" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (authMode === 'register' ? handleRegister() : handleLogin())}
                style={inputStyle} />
              {authMode === 'register' && (
                <input type="text" placeholder="邀请码（选填）" value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)} maxLength={20} style={inputStyle} />
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setAuthMode('idle'); setNickname(''); setPassword(''); setInviteCode('') }}>取消</button>
                <button className="btn btn-primary" style={{ flex: 1, opacity: authLoading ? 0.6 : 1 }} onClick={authMode === 'register' ? handleRegister : handleLogin} disabled={authLoading}>
                  {authLoading ? '处理中...' : authMode === 'register' ? '注册' : '登录'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
          <button style={{ ...firstEntryStyle, cursor: 'pointer' }} onClick={onOpenProfile}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 20, background: 'var(--bg-card)',
                border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22
              }}>
                {AVATARS[profile.avatarIndex ?? 0]}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{profile.nickname}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {lastBackup ? `上次备份: ${lastBackup}` : '点击查看个人资料'}
                </div>
              </div>
            </div>
            <Chevron />
          </button>
          <button style={{ ...midEntryStyle, cursor: 'pointer' }} onClick={() => setShowCloudSheet(true)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <EntryIcon bg="rgba(100,149,237,0.15)" color="#6495ed">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /></svg>
              </EntryIcon>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>云端数据</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>备份到云端 · 从云端恢复</div>
              </div>
            </div>
            <Chevron />
          </button>
          <button style={{ ...lastEntryStyle, cursor: 'pointer' }} onClick={handleLogout}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <EntryIcon bg="rgba(224,85,85,0.15)" color="var(--danger)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              </EntryIcon>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--danger)' }}>退出登录</div>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* 通用 */}
      <h3 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>通用</h3>
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ ...firstEntryStyle, cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <EntryIcon bg={theme === 'dark' ? 'rgba(240,192,64,0.15)' : 'rgba(200,144,48,0.15)'} color="var(--accent)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            </EntryIcon>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>深色模式</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{theme === 'dark' ? '已开启' : '已关闭'}</div>
            </div>
          </div>
          <button className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={toggleTheme} />
        </div>

        <div style={{ ...(profile ? midEntryStyle : lastEntryStyle), cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <EntryIcon bg="rgba(100,149,237,0.15)" color="#6495ed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
            </EntryIcon>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>自动检查更新</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>启动时自动检查新版本</div>
            </div>
          </div>
          <button className={`toggle ${autoCheck ? 'active' : ''}`} onClick={toggleAutoCheck} />
        </div>
        {profile && (
          <button style={lastEntryStyle} onClick={() => setShowBackupFreqSheet(true)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <EntryIcon bg="rgba(240,192,64,0.15)" color="var(--accent)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </EntryIcon>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>备份频率</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>每 {backupFrequency} 分钟自动备份</div>
              </div>
            </div>
            <Chevron />
          </button>
        )}
      </div>

      {/* 存储 */}
      <h3 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>存储</h3>
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        {onOpenCacheManager && (
          <button style={firstEntryStyle} onClick={onOpenCacheManager}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <EntryIcon bg="rgba(76,175,132,0.15)" color="var(--success)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              </EntryIcon>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>缓存管理</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {cacheTask ? `正在缓存: ${cacheTask.title} ${cacheTask.progress}%` : `${storageInfo.books}本 · ${storageInfo.chapters}章 · ${storageInfo.size}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {cacheTask && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
              <Chevron />
            </div>
          </button>
        )}

        <button style={onOpenCacheManager ? midEntryStyle : firstEntryStyle} onClick={() => setShowClearConfirm(true)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <EntryIcon bg="rgba(224,85,85,0.15)" color="var(--danger)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </EntryIcon>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--danger)' }}>清除所有数据</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>书架、缓存、设置全部重置</div>
            </div>
          </div>
          <Chevron />
        </button>
      </div>

      {/* 关于 */}
      <h3 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>关于</h3>
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <button style={firstEntryStyle} onClick={onOpenAbout}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <EntryIcon bg="var(--accent-glow)" color="var(--accent)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            </EntryIcon>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>关于 Yellow</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>版本更新 · 迭代日志 · 书源信息</div>
            </div>
          </div>
          <Chevron />
        </button>
      </div>

      {cacheTask && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>正在缓存: {cacheTask.title}</span>
            <span>{cacheTask.current}/{cacheTask.total}章</span>
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${cacheTask.progress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* 云端数据底部弹窗 */}
      {showCloudSheet && (
        <div className="modal-overlay" onClick={() => setShowCloudSheet(false)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>云端数据</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              备份书架、阅读进度和设置到云端，或从云端恢复数据。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setShowCloudSheet(false); doBackup(false) }}>
                备份到云端
              </button>
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={async () => {
                setShowCloudSheet(false)
                const ok = await doRestore()
                showToast(ok ? '已从云端恢复数据' : '恢复失败')
              }}>
                从云端恢复
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 备份频率选择弹窗 */}
      {showBackupFreqSheet && (
        <div className="modal-overlay" onClick={() => setShowBackupFreqSheet(false)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>备份频率</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              自动备份将消耗流量，建议保持 WiFi 连接。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 5, 10, 30].map(mins => (
                <button
                  key={mins}
                  className={backupFrequency === mins ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ width: '100%' }}
                  onClick={() => changeBackupFreq(mins)}
                >
                  每 {mins} 分钟
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontSize: 16, marginBottom: 8, color: 'var(--danger)' }}>清除所有数据</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              将清除书架、阅读缓存、阅读进度和所有设置，恢复到全新安装状态。此操作不可撤销。
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowClearConfirm(false)}>取消</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleClearAll}>确认清除</button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>确认退出登录</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              退出前将自动备份数据到云端。确定要退出吗？
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowLogoutConfirm(false)}>取消</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmLogout}>确认退出</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
