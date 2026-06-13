import { useState, useEffect } from 'react'
import type { Book } from '../types'
import { getStorageInfo, clearCache } from '../utils/db'

interface Props {
  books: Book[]
  showToast: (msg: string) => void
}

export default function Settings({ books, showToast }: Props) {
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
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
          存储管理
        </h3>
        <div
          className="card"
          style={{ padding: 16 }}
        >
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
          >
            清除所有缓存
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
          关于应用
        </h3>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>应用名称</span>
            <span style={{ fontWeight: 600 }}>Yellow Reader</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>版本</span>
            <span style={{ fontWeight: 600 }}>1.0.0</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>技术栈</span>
            <span style={{ fontWeight: 600 }}>React + Capacitor</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>书源</span>
            <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '60%', fontSize: 13 }}>
              Project Gutenberg / Open Library
            </span>
          </div>
        </div>
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
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowClearConfirm(false)}
              >
                取消
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={handleClear}
              >
                确认清除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
