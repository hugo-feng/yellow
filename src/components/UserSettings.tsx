import { useState, useCallback } from 'react'
import type { Book, ReadingProgress } from '../types'
import { getStoredProfile, storeProfile, clearProfile, isRegistered, createProfile, uploadData, downloadData, type UserProfile, type SyncData } from '../utils/github-sync'
import { getAllBooks, saveBook, saveProgress, getProgress } from '../utils/db'

interface Props {
  books: Book[]
  showToast: (msg: string) => void
  onSyncComplete: (books: Book[]) => void
}

export default function UserSettings({ books, showToast, onSyncComplete }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(getStoredProfile)
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [showRegister, setShowRegister] = useState(false)

  const handleRegister = useCallback(() => {
    const name = nickname.trim()
    if (!name) { showToast('请输入昵称'); return }
    if (name.length < 2 || name.length > 12) { showToast('昵称2-12个字符'); return }
    const p = createProfile(name)
    setProfile(p)
    setNickname('')
    setShowRegister(false)
    showToast(`欢迎, ${p.nickname}!`)
  }, [nickname, showToast])

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
      const data: SyncData = {
        profile,
        books: allBooks,
        progress: progressList,
        readerSettings: settings ? JSON.parse(settings) : null,
        syncedAt: new Date().toISOString()
      }
      await uploadData(data)
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
      showToast(`已恢复 ${data.books.length} 本书`)
    } catch (e) {
      showToast('恢复失败: ' + (e as Error).message)
    }
    setLoading(false)
  }, [profile, showToast, onSyncComplete])

  if (!profile) {
    return (
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>未注册</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>注册后可同步书架数据到云端</div>
          </div>
        </div>

        {!showRegister ? (
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowRegister(true)}>
            注册账号
          </button>
        ) : (
          <div>
            <input
              type="text"
              placeholder="输入昵称（2-12个字符）"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              maxLength={12}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', fontSize: 14, marginBottom: 8,
                outline: 'none', boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowRegister(false); setNickname('') }}>取消</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleRegister}>注册</button>
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
          width: 40, height: 40, borderRadius: 20,
          background: profile.avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 16
        }}>
          {profile.nickname.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{profile.nickname}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {profile.userId}</div>
        </div>
        <button style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer' }} onClick={handleLogout}>退出</button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1, opacity: loading ? 0.6 : 1 }} onClick={handleUpload} disabled={loading}>
          {loading ? '同步中...' : '上传到云端'}
        </button>
        <button className="btn btn-secondary" style={{ flex: 1, opacity: loading ? 0.6 : 1 }} onClick={handleDownload} disabled={loading}>
          {loading ? '恢复中...' : '从云端恢复'}
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
        数据存储在开发者 GitHub 仓库中，用昵称标识
      </div>
    </div>
  )
}
