import { useState, useCallback } from 'react'
import type { Book, ReadingProgress, ReaderSettings } from '../types'
import { verifyToken, storeAuth, clearAuth, getStoredUser, isLoggedIn, syncToGitHub, syncFromGitHub, type GitHubUser, type SyncData } from '../utils/github-sync'
import { getAllBooks, saveBook, saveProgress, getProgress } from '../utils/db'

interface Props {
  books: Book[]
  showToast: (msg: string) => void
  onSyncComplete: (books: Book[]) => void
}

export default function UserSettings({ books, showToast, onSyncComplete }: Props) {
  const [user, setUser] = useState<GitHubUser | null>(getStoredUser)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const handleLogin = useCallback(async () => {
    if (!token.trim()) { showToast('请输入 GitHub Token'); return }
    setLoading(true)
    try {
      const u = await verifyToken(token.trim())
      storeAuth(token.trim(), u)
      setUser(u)
      setToken('')
      setShowTokenInput(false)
      showToast(`欢迎, ${u.name}!`)
    } catch (e) {
      showToast('登录失败: ' + (e as Error).message)
    }
    setLoading(false)
  }, [token, showToast])

  const handleLogout = useCallback(() => {
    clearAuth()
    setUser(null)
    showToast('已退出登录')
  }, [showToast])

  const handleUpload = useCallback(async () => {
    setSyncing(true)
    try {
      const allBooks = await getAllBooks()
      const progressList: any[] = []
      for (const book of allBooks) {
        const p = await getProgress(book.id)
        if (p) progressList.push(p)
      }
      const settings = localStorage.getItem('reader-settings')
      const data: SyncData = {
        books: allBooks,
        progress: progressList,
        readerSettings: settings ? JSON.parse(settings) : null,
        syncedAt: new Date().toISOString()
      }
      await syncToGitHub(data)
      showToast('数据已同步到 GitHub')
    } catch (e) {
      showToast('同步失败: ' + (e as Error).message)
    }
    setSyncing(false)
  }, [books, showToast])

  const handleDownload = useCallback(async () => {
    setSyncing(true)
    try {
      const data = await syncFromGitHub()
      if (!data) { showToast('云端无数据'); setSyncing(false); return }

      for (const book of data.books) {
        await saveBook(book)
      }
      for (const p of data.progress) {
        await saveProgress(p)
      }
      if (data.readerSettings) {
        localStorage.setItem('reader-settings', JSON.stringify(data.readerSettings))
      }
      const freshBooks = await getAllBooks()
      onSyncComplete(freshBooks)
      showToast(`已恢复 ${data.books.length} 本书，同步时间: ${new Date(data.syncedAt).toLocaleString()}`)
    } catch (e) {
      showToast('恢复失败: ' + (e as Error).message)
    }
    setSyncing(false)
  }, [showToast, onSyncComplete])

  if (!user) {
    return (
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>未登录</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>登录后可同步书架数据到 GitHub</div>
          </div>
        </div>

        {!showTokenInput ? (
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowTokenInput(true)}>
            登录 GitHub
          </button>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
              前往 <span style={{ color: 'var(--accent)' }}>github.com/settings/tokens</span> 生成 Personal Access Token，勾选 <strong>gist</strong> 权限
            </div>
            <input
              type="password"
              placeholder="粘贴 GitHub Token (ghp_...)"
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', fontSize: 13, marginBottom: 8,
                outline: 'none', boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowTokenInput(false); setToken('') }}>取消</button>
              <button className="btn btn-primary" style={{ flex: 1, opacity: loading ? 0.6 : 1 }} onClick={handleLogin} disabled={loading}>
                {loading ? '验证中...' : '登录'}
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
        <img src={user.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: 20 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{user.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{user.login}</div>
        </div>
        <button style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer' }} onClick={handleLogout}>退出</button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1, opacity: syncing ? 0.6 : 1 }} onClick={handleUpload} disabled={syncing}>
          {syncing ? '同步中...' : '上传到 GitHub'}
        </button>
        <button className="btn btn-secondary" style={{ flex: 1, opacity: syncing ? 0.6 : 1 }} onClick={handleDownload} disabled={syncing}>
          {syncing ? '恢复中...' : '从 GitHub 恢复'}
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
        数据存储在你的 GitHub 私有 Gist 中，仅你可见
      </div>
    </div>
  )
}
