import { useState, useEffect } from 'react'
import type { Book } from '../types'
import { getStorageInfo, clearCache } from '../utils/db'
import { useTheme } from '../hooks/useTheme'

interface Props {
  books: Book[]
  showToast: (msg: string) => void
  onOpenAbout: () => void
  cacheTask?: { bookId: string; title: string; progress: number; current: number; total: number } | null
  onOpenCacheManager?: () => void
}

export default function Settings({ books, showToast, onOpenAbout, cacheTask, onOpenCacheManager }: Props) {
  const [storageInfo, setStorageInfo] = useState({ books: 0, chapters: 0, size: '0 B' })
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const { theme, toggle: toggleTheme } = useTheme()

  useEffect(() => { getStorageInfo().then(setStorageInfo) }, [books])

  const handleClear = async () => {
    await clearCache(); showToast('缓存已清除'); setShowClearConfirm(false)
    setStorageInfo({ books: 0, chapters: 0, size: '0 B' })
    setTimeout(() => window.location.reload(), 500)
  }

  return (
    <div style={{ padding: 16 }}>
      {/* 外观 */}
      <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>外观</h3>
      <div className="card" style={{ padding: '14px 16px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>暗黑模式</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{theme === 'dark' ? '已开启' : '已关闭'}</div>
          </div>
          <button className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={toggleTheme} />
        </div>
      </div>

      {/* 关于 */}
      <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>其他</h3>
      <button className="card" style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px', marginBottom: 12, cursor: 'pointer', background: 'var(--bg-card)',
        border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14
      }} onClick={onOpenAbout}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600 }}>关于 Yellow</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>版本更新 · 迭代日志 · 书源信息</div>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><polyline points="9 18 15 12 9 6" /></svg>
      </button>

      {/* 存储 */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>缓存书籍</span>
          <span style={{ fontWeight: 600 }}>{storageInfo.books} 本</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>缓存章节</span>
          <span style={{ fontWeight: 600 }}>{storageInfo.chapters} 章</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>占用空间</span>
          <span style={{ fontWeight: 600 }}>{storageInfo.size}</span>
        </div>
        <button className="btn btn-danger btn-block btn-sm" onClick={() => setShowClearConfirm(true)} disabled={storageInfo.books === 0}>清除所有缓存</button>
      </div>

      {/* 缓存管理 */}
      {onOpenCacheManager && (
        <button className="card" style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px', marginBottom: 12, marginTop: 12, cursor: 'pointer', background: 'var(--bg-card)',
          border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14
        }} onClick={onOpenCacheManager}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(76,175,132,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600 }}>缓存管理</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {cacheTask ? `正在缓存: ${cacheTask.title} ${cacheTask.progress}%` : '查看已缓存内容 · 管理存储空间'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {cacheTask && <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><polyline points="9 18 15 12 9 6" /></svg>
          </div>
        </button>
      )}

      {/* 缓存任务进度 */}
      {cacheTask && (
        <div style={{ marginBottom: 12, marginTop: 12 }}>
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
            <h3 style={{ fontSize: 16, marginBottom: 12, color: 'var(--danger)' }}>确认清除</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>此操作将清除所有缓存的书籍和章节内容，书架上的书也会被移除。确定继续？</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowClearConfirm(false)}>取消</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleClear}>确认清除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
