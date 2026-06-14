import { useState, useEffect } from 'react'
import type { Book } from '../types'
import { getStorageInfo, clearCache } from '../utils/db'
import { useTheme } from '../hooks/useTheme'
import UserSettings from './UserSettings'
import { hasInviteCode, isInviteCodeValid, setInviteCode as saveInviteCode } from '../utils/invite'

interface Props {
  books: Book[]
  showToast: (msg: string) => void
  onOpenAbout: () => void
  cacheTask?: { bookId: string; title: string; progress: number; current: number; total: number } | null
  onOpenCacheManager?: () => void
  onSyncComplete?: (books: Book[]) => void
}

export default function Settings({ books, showToast, onOpenAbout, cacheTask, onOpenCacheManager, onSyncComplete }: Props) {
  const { theme, toggle: toggleTheme } = useTheme()
  const [autoCheck, setAutoCheck] = useState(() => localStorage.getItem('ota-auto-check') !== 'off')
  const [storageInfo, setStorageInfo] = useState({ books: 0, chapters: 0, size: '0 B' })
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteActivated, setInviteActivated] = useState(() => hasInviteCode())

  useEffect(() => { getStorageInfo().then(setStorageInfo) }, [books])

  const toggleAutoCheck = () => {
    const next = !autoCheck
    setAutoCheck(next)
    localStorage.setItem('ota-auto-check', next ? 'on' : 'off')
    showToast(next ? '启动时自动检查更新' : '已关闭自动检查更新')
  }

  const handleClearAll = async () => {
    await clearCache()
    localStorage.clear()
    showToast('已清除所有数据')
    setShowClearConfirm(false)
    setTimeout(() => window.location.reload(), 500)
  }

  const handleConfirmInviteCode = () => {
    if (isInviteCodeValid(inviteCode)) {
      saveInviteCode(inviteCode)
      setInviteActivated(true)
      setInviteCode('')
      showToast('邀请码已激活')
    } else {
      showToast('邀请码无效')
    }
  }

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

  return (
    <div style={{ padding: 16 }}>
      {/* 用户账号 */}
      <UserSettings books={books} showToast={showToast} onSyncComplete={onSyncComplete || (() => {})} />

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

        <div style={{ ...lastEntryStyle, cursor: 'default' }}>
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
      </div>

      {/* 邀请码 */}
      <h3 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>邀请码</h3>
      <div className="card" style={{ marginBottom: 20, padding: 14 }}>
        {inviteActivated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            <span style={{ fontSize: 14, color: 'var(--success)', fontWeight: 600 }}>已激活</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>已解锁全部书源</span>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>填写邀请码可解锁更多书源（选填）</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="输入邀请码"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConfirmInviteCode()}
                maxLength={20}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg-primary)',
                  color: 'var(--text-primary)', fontSize: 14, outline: 'none'
                }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleConfirmInviteCode}>确认</button>
            </div>
          </>
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
    </div>
  )
}
