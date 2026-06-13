import { useState, useEffect } from 'react'
import type { Book } from '../types'
import { getStorageInfo, clearCache } from '../utils/db'

interface Props {
  books: Book[]
  showToast: (msg: string) => void
  onOpenAbout: () => void
}

export default function Settings({ books, showToast, onOpenAbout }: Props) {
  const [storageInfo, setStorageInfo] = useState({ books: 0, chapters: 0, size: '0 B' })
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    getStorageInfo().then(setStorageInfo)
  }, [books])

  const handleClear = async () => {
    await clearCache()
    showToast('缓存已清除')
    setShowClearConfirm(false)
    setStorageInfo({ books: 0, chapters: 0, size: '0 B' })
    setTimeout(() => window.location.reload(), 500)
  }

  return (
    <div style={{ padding: 16 }}>
      {/* 关于入口 */}
      <button
        className="card"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px', marginBottom: 20, cursor: 'pointer', background: 'var(--bg-card)',
          border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14
        }}
        onClick={onOpenAbout}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: 'var(--accent-glow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600 }}>关于 Yellow</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>版本更新 · 迭代日志 · 书源信息</div>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* 存储管理 */}
      <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>存储管理</h3>
      <div className="card" style={{ padding: 16, marginBottom: 24 }}>
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
        <button
          className="btn btn-danger btn-block btn-sm"
          onClick={() => setShowClearConfirm(true)}
          disabled={storageInfo.books === 0}
        >清除所有缓存</button>
      </div>

      {showClearConfirm && (
        <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontSize: 16, marginBottom: 12, color: 'var(--danger)' }}>确认清除</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
              此操作将清除所有缓存的书籍和章节内容，书架上的书也会被移除。确定继续？
            </p>
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
