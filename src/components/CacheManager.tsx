import { useState, useEffect } from 'react'
import { getAllBooks, getBookChapters, removeBook } from '../utils/db'

interface CacheBookInfo {
  id: string
  title: string
  author: string
  chapterCount: number
  cachedChapters: number
  size: string
}

interface CacheTask {
  bookId: string
  title: string
  progress: number
  current: number
  total: number
}

interface Props {
  onClose: () => void
  showToast: (msg: string) => void
  cacheTask?: CacheTask | null
}

export default function CacheManager({ onClose, showToast, cacheTask }: Props) {
  const [books, setBooks] = useState<CacheBookInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadBooks = async () => {
    setLoading(true)
    try {
      const allBooks = await getAllBooks()
      const infos: CacheBookInfo[] = []
      for (const book of allBooks) {
        const chapters = await getBookChapters(book.id)
        const cached = chapters.filter(c => c.cached)
        const size = new Blob([JSON.stringify(book)]).size + cached.reduce((s, c) => s + new Blob([c.content || '']).size, 0)
        infos.push({
          id: book.id,
          title: book.title,
          author: book.author || '未知',
          chapterCount: book.chapters?.length || 0,
          cachedChapters: cached.length,
          size: size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)}MB` : size > 1024 ? `${(size / 1024).toFixed(1)}KB` : `${size}B`
        })
      }
      setBooks(infos)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadBooks() }, [])

  const handleDelete = async (id: string) => {
    await removeBook(id)
    setBooks(prev => prev.filter(b => b.id !== id))
    setConfirmDelete(null)
    showToast('已删除缓存')
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <div className="header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer', padding: 0, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', flex: 1 }}>缓存管理</h1>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px calc(var(--safe-bottom, 0px) + 16px)' }}>
        {cacheTask && (
          <div className="card" style={{ padding: 16, marginBottom: 16, borderLeft: '3px solid var(--accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{cacheTask.title}</span>
              <span style={{ fontSize: 12, color: 'var(--accent)' }}>{cacheTask.current}/{cacheTask.total}</span>
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${cacheTask.progress}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>正在缓存... {cacheTask.progress}%</div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : books.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 40 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            <h3 style={{ marginTop: 12 }}>暂无缓存</h3>
            <p style={{ fontSize: 13 }}>在书籍详情页点击「缓存」按钮下载内容</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {books.map(b => (
              <div key={b.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 54, borderRadius: 4, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {b.title.slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{b.cachedChapters}/{b.chapterCount}章 · {b.size}</div>
                </div>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', padding: '6px 10px', borderRadius: 6 }}
                  onClick={() => setConfirmDelete(b.id)}
                >删除</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontSize: 16, marginBottom: 12, color: 'var(--danger)' }}>删除缓存</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>确定删除这本缓存？书架上的书也会被移除。</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>取消</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleDelete(confirmDelete)}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
