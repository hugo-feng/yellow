import { useState, useCallback } from 'react'
import type { Book } from '../types'
import { getStoredProfile, clearProfile, createProfile, verifyLogin, uploadData, downloadData, type UserProfile } from '../utils/github-sync'
import { getAllBooks, saveBook, saveProgress, getProgress } from '../utils/db'

interface Props {
  books: Book[]
  showToast: (msg: string) => void
  onSyncComplete: (books: Book[]) => void
}

export default function UserSettings({ books, showToast, onSyncComplete }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(getStoredProfile)
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'idle' | 'register' | 'login'>('idle')

  const handleRegister = useCallback(async () => {
    const name = nickname.trim()
    if (!name) { showToast('请输入昵称'); return }
    if (name.length < 2 || name.length > 12) { showToast('昵称2-12个字符'); return }
    if (password.length < 4) { showToast('密码至少4位'); return }
    setLoading(true)
    try {
      const p = await createProfile(name, password)
      setProfile(p)
      setNickname(''); setPassword(''); setMode('idle')
      showToast(`欢迎, ${p.nickname}!`)
    } catch (e) {
      showToast('注册失败: ' + (e as Error).message)
    }
    setLoading(false)
  }, [nickname, password, showToast])

  const handleLogin = useCallback(async () => {
    const name = nickname.trim()
    if (!name || !password) { showToast('请输入昵称和密码'); return }
    setLoading(true)
    try {
      const p = await verifyLogin(name, password)
      if (p) {
        setProfile(p)
        setNickname(''); setPassword(''); setMode('idle')
        showToast(`欢迎回来, ${p.nickname}!`)
      } else {
        showToast('昵称或密码错误')
      }
    } catch (e) {
      showToast('登录失败: ' + (e as Error).message)
    }
    setLoading(false)
  }, [nickname, password, showToast])

  const handleLogout = useCallback(() => {
    clearProfile()
    setProfile(null)
    showToast('已退出')
  }, [showToast])

  const handleUpload = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    try {
      const allBooks = await getAllBooks()
      const progressList: any[] = []
      for (const book of allBooks) {
        const p = await getProgress(book.id)
        if (p) progressList.push(p)
      }
      const settings = localStorage.getItem('reader-settings')
      await uploadData({
        profile,
        books: allBooks,
        progress: progressList,
        readerSettings: settings ? JSON.parse(settings) : null,
        syncedAt: new Date().toISOString()
      })
      showToast('数据已同步到云端')
    } catch (e) {
      showToast('同步失败: ' + (e as Error).message)
    }
    setLoading(false)
  }, [profile, books, showToast])

  const handleDownload = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    try {
      const data = await downloadData(profile.userId)
      if (!data) { showToast('云端无数据'); setLoading(false); return }
      for (const book of data.books) await saveBook(book)
      for (const p of data.progress) await saveProgress(p)
      if (data.readerSettings) localStorage.setItem('reader-settings', JSON.stringify(data.readerSettings))
      onSyncComplete(await getAllBooks())
      showToast(`已恢复 ${data.books.length} 本书`)
    } catch (e) {
      showToast('恢复失败: ' + (e as Error).message)
    }
    setLoading(false)
  }, [profile, showToast, onSyncComplete])

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
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>登录后可同步书架数据</div>
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
              onChange={e => setNickname(e.target.value)} maxLength={12} style={inputStyle} />
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
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>云端同步已开启</div>
        </div>
        <button style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer' }} onClick={handleLogout}>退出</button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1, opacity: loading ? 0.6 : 1 }} onClick={handleUpload} disabled={loading}>
          {loading ? '同步中...' : '备份到云端'}
        </button>
        <button className="btn btn-secondary" style={{ flex: 1, opacity: loading ? 0.6 : 1 }} onClick={handleDownload} disabled={loading}>
          {loading ? '恢复中...' : '从云端恢复'}
        </button>
      </div>
    </div>
  )
}
