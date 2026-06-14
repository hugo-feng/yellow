import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAllBooks, getBookChapters, getChaptersByIdPrefix, removeBook, getStorageInfo } from '../utils/db'

interface CacheBookInfo {
  id: string
  title: string
  author: string
  chapterCount: number
  cachedChapters: number
  size: number
  sizeStr: string
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

async function fetchCacheBooks(): Promise<CacheBookInfo[]> {
  const allBooks = await getAllBooks()
  const infos: CacheBookInfo[] = []
  for (const book of allBooks) {
    // Try to find cached chapters by bookId (new method)
    let dbChapters: any[] = []
    try { dbChapters = await getBookChapters(book.id) } catch {}
    const dbCached = dbChapters.filter(c => c.cached)
    
    // Also find chapters by ID prefix (for chapters saved before bookId field was added)
    let prefixChapters: any[] = []
    try { prefixChapters = await getChaptersByIdPrefix(book.id) } catch {}
    const prefixCached = prefixChapters.filter(c => c.cached)
    
    // Chapters with content in the book object itself are also cached
    const bookChapters = book.chapters || []
    const bookCached = bookChapters.filter(c => c.content && c.content.length > 0)
    
    // Use the highest count from all methods
    const cachedCount = Math.max(dbCached.length, prefixCached.length, bookCached.length)
    const totalChapters = bookChapters.length || 0
    const dbSize = Math.max(
      dbCached.reduce((s, c) => s + new Blob([c.content || '']).size, 0),
      prefixCached.reduce((s, c) => s + new Blob([c.content || '']).size, 0)
    )
    const size = new Blob([JSON.stringify(book)]).size + dbSize
    infos.push({
      id: book.id,
      title: book.title,
      author: book.author || '未知',
      chapterCount: totalChapters,
      cachedChapters: cachedCount,
      size,
      sizeStr: size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`
    })
  }
  return infos.sort((a, b) => b.size - a.size)
}

export default function CacheManager({ onClose, showToast, cacheTask }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: books = [], isLoading } = useQuery({
    queryKey: ['cacheBooks'],
    queryFn: fetchCacheBooks,
    staleTime: 30_000,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await removeBook(id) },
    onSuccess: (_, id) => {
      queryClient.setQueryData<CacheBookInfo[]>(['cacheBooks'], prev => (prev || []).filter(b => b.id !== id))
      setConfirmDelete(null)
      showToast('已删除缓存')
    }
  })

  const totalSize = books.reduce((s, b) => s + b.size, 0)
  const totalSizeStr = totalSize > 1024 * 1024 ? `${(totalSize / 1024 / 1024).toFixed(1)} MB` : totalSize > 1024 ? `${(totalSize / 1024).toFixed(1)} KB` : `${totalSize} B`

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer', padding: 0, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', flex: 1 }}>缓存管理</h1>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px calc(var(--safe-bottom, 0px) + 16px)' }}>
        {/* Storage summary */}
        <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>已用存储</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>{totalSizeStr}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>缓存书籍</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{books.length}</div>
          </div>
        </div>

        {/* Active cache task */}
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

        {/* Book list */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : books.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 40 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            <h3 style={{ marginTop: 12, color: 'var(--text-secondary)' }}>暂无缓存</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>在书籍详情页点击「缓存」按钮下载内容</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {books.map(b => (
              <div key={b.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 56, borderRadius: 4,
                  background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, overflow: 'hidden'
                }}>
                  {b.title.slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{b.author}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <div style={{ flex: 1, height: 3, borderRadius: 1.5, background: 'var(--border)' }}>
                      <div style={{ height: '100%', width: `${b.chapterCount > 0 ? (b.cachedChapters / b.chapterCount * 100) : 0}%`, borderRadius: 1.5, background: 'var(--success)' }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{b.cachedChapters}/{b.chapterCount}章 · {b.sizeStr}</span>
                  </div>
                </div>
                <button
                  style={{ background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', padding: '4px 10px', borderRadius: 6, flexShrink: 0 }}
                  onClick={() => setConfirmDelete(b.id)}
                >删除</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontSize: 16, marginBottom: 12, color: 'var(--danger)' }}>删除缓存</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>确定删除这本缓存？书架上的书也会被移除。</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>取消</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => deleteMutation.mutate(confirmDelete)}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
