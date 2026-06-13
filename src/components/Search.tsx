import { useState, useCallback, useRef, useEffect } from 'react'
import type { Book, SearchResult } from '../types'
import { searchAcrossSources, getBookContent, allSources, getSourceName } from '../utils/sources'
import { saveBook } from '../utils/db'

interface Props {
  onAddBook: (book: Book) => void
  onRead: (book: Book) => void
  showToast: (msg: string) => void
  books: Book[]
}

export default function SearchPage({ onAddBook, onRead, showToast, books }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeSourceIds, setActiveSourceIds] = useState<string[]>(
    Object.values(allSources).filter(s => s.enabled).map(s => s.id)
  )
  const [showSourcePicker, setShowSourcePicker] = useState(false)
  const [loadingBookId, setLoadingBookId] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (!q.trim()) {
      setResults([])
      return
    }

    searchTimeout.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchAcrossSources(q.trim(), activeSourceIds)
        setResults(res)
      } catch {
        showToast('搜索失败，请检查网络')
        setResults([])
      }
      setLoading(false)
    }, 400)
  }, [activeSourceIds, showToast])

  const handleAddOrRead = useCallback(async (result: SearchResult) => {
    const existing = books.find(b => b.id === result.id && b.sourceId === result.sourceId)
    if (existing) {
      onRead(existing)
      return
    }

    setLoadingBookId(result.id)
    try {
      const book = await getBookContent(result.id, result.sourceId)
      await saveBook(book)
      onAddBook(book)
      showToast(`已添加：${book.title}`)
    } catch {
      showToast('获取书籍失败，请重试')
    }
    setLoadingBookId(null)
  }, [books, onAddBook, onRead, showToast])

  const toggleSource = useCallback((sourceId: string) => {
    setActiveSourceIds(prev =>
      prev.includes(sourceId)
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    )
    if (query.trim()) {
      handleSearch(query)
    }
  }, [query, handleSearch])

  return (
    <div style={{ padding: 12 }}>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          className="input"
          type="text"
          placeholder="搜索书名、作者..."
          value={query}
          onChange={e => handleSearch(e.target.value)}
          autoFocus
        />
        {loading && (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <div className="spinner" />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>书源：</span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowSourcePicker(true)}
          style={{ fontSize: 12 }}
        >
          {activeSourceIds.length} 个源已选
        </button>
        {activeSourceIds.map(id => (
          <span key={id} className="badge" style={{ fontSize: 10 }}>
            {getSourceName(id)}
          </span>
        ))}
      </div>

      {results.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, padding: '0 4px' }}>
          找到 {results.length} 个结果
        </div>
      )}

      {!query.trim() && !loading && (
        <div className="empty-state" style={{ paddingTop: 60 }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <h3>搜索你喜欢的书</h3>
          <p style={{ marginTop: 4, fontSize: 13 }}>支持 Project Gutenberg 和 Open Library</p>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ display: 'flex', padding: 12, gap: 12 }}>
              <div className="skeleton" style={{ width: 60, height: 80 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: '70%', height: 16, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: '40%', height: 12, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: '60%', height: 12 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 40 }}>
          <h3>未找到相关书籍</h3>
          <p style={{ marginTop: 4, fontSize: 13 }}>试试更换搜索词或切换书源</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {results.map((result, idx) => {
            const isAdded = books.some(b => b.id === result.id && b.sourceId === result.sourceId)
            return (
              <div
                key={`${result.sourceId}-${result.id}`}
                className="card fade-in"
                style={{
                  display: 'flex',
                  padding: 12,
                  gap: 12,
                  animationDelay: `${idx * 0.04}s`,
                  opacity: isAdded ? 0.65 : 1
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 80,
                    borderRadius: 6,
                    background: result.cover
                      ? `url(${result.cover}) center/cover`
                      : 'var(--bg-hover)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    overflow: 'hidden'
                  }}
                >
                  {!result.cover && '无封面'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {result.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {result.author}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    <span className="badge" style={{ fontSize: 10 }}>
                      {result.sourceName}
                    </span>
                    {isAdded && (
                      <span className="badge" style={{ background: 'rgba(76,175,132,0.15)', color: 'var(--success)', fontSize: 10 }}>
                        已添加
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {result.description}
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: 8, width: '100%' }}
                    onClick={() => handleAddOrRead(result)}
                    disabled={loadingBookId === result.id}
                  >
                    {loadingBookId === result.id ? '加载中...' : isAdded ? '直接阅读' : '添加到书架'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showSourcePicker && (
        <div className="modal-overlay" onClick={() => setShowSourcePicker(false)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontSize: 16, marginBottom: 14, color: 'var(--accent)' }}>选择书源</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.values(allSources).map(source => (
                <div
                  key={source.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    background: activeSourceIds.includes(source.id) ? 'var(--bg-hover)' : 'var(--bg-card)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    border: activeSourceIds.includes(source.id) ? '1px solid var(--accent)' : '1px solid var(--border)',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => toggleSource(source.id)}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{source.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{source.baseUrl}</div>
                  </div>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      background: activeSourceIds.includes(source.id) ? 'var(--accent)' : 'var(--bg-input)',
                      border: activeSourceIds.includes(source.id) ? 'none' : '2px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    {activeSourceIds.includes(source.id) && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: 16 }}
              onClick={() => setShowSourcePicker(false)}
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
