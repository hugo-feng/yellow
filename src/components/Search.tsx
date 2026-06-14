import { useState, useCallback, useRef, useEffect } from 'react'
import type { Book, SearchResult } from '../types'
import { searchAcrossSources, getBookContent } from '../utils/sources'
import { saveBook } from '../utils/db'
import { hasInviteCode } from '../utils/invite'

interface Props {
  onAddBook: (book: Book) => void
  onRead: (book: Book) => void
  onViewDetail?: (book: Book) => void
  showToast: (msg: string) => void
  books: Book[]
}

interface LocalBookIndex {
  id: string; title: string; author: string; cover?: string; sourceId: string; sourceName: string; description: string
}

const HISTORY_KEY = 'yellow-search-history'
const MAX_HISTORY = 15

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}
function saveHistory(terms: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(terms))
}

export default function SearchPage({ onAddBook, onRead, onViewDetail, showToast, books }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingBookId, setLoadingBookId] = useState<string | null>(null)
  const [localIndex, setLocalIndex] = useState<LocalBookIndex[]>([])
  const [history, setHistory] = useState<string[]>(loadHistory)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('books/index.json').then(r => r.json()).then((data: LocalBookIndex[]) => {
      setLocalIndex(data)
    }).catch(() => {})
  }, [])

  const addToHistory = useCallback((term: string) => {
    const t = term.trim()
    if (!t) return
    setHistory(prev => {
      const next = [t, ...prev.filter(h => h !== t)].slice(0, MAX_HISTORY)
      saveHistory(next)
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    saveHistory([])
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    addToHistory(q)

    const allResults: SearchResult[] = []
    const seen = new Set<string>()
    const kw = q.trim().toLowerCase()

    // Local search (instant)
    const allowJisge = hasInviteCode()
    for (const book of localIndex) {
      if (!allowJisge && book.sourceId === 'jisge') continue
      if (book.title.toLowerCase().includes(kw) || book.description.toLowerCase().includes(kw) || book.author.toLowerCase().includes(kw)) {
        const key = `${book.sourceId}-${book.id}`
        if (!seen.has(key)) {
          seen.add(key)
          allResults.push({
            id: book.id, title: book.title, author: book.author || '未知',
            cover: book.cover || '', description: book.description || '',
            sourceId: book.sourceId, sourceName: book.sourceName,
            format: 'html', downloadUrl: ''
          })
        }
      }
    }
    setResults([...allResults])
    setLoading(false)

    // Online search (append results, loading already false)
    try {
      const onlineResults = await searchAcrossSources(q.trim())
      for (const r of onlineResults) {
        const key = `${r.sourceId}-${r.id}`
        if (!seen.has(key)) {
          seen.add(key)
          allResults.push(r)
        }
      }
      setResults([...allResults])
    } catch { /* online failed */ }
  }, [localIndex, addToHistory])

  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!q.trim()) { setResults([]); return }
    searchTimeout.current = setTimeout(() => doSearch(q), 250)
  }, [doSearch])

  const handleHistoryClick = useCallback((term: string) => {
    setQuery(term)
    doSearch(term)
  }, [doSearch])

  const handleClear = useCallback(() => {
    setQuery('')
    setResults([])
    inputRef.current?.focus()
  }, [])

  const handleAddOrRead = useCallback(async (result: SearchResult) => {
    const existing = books.find(b => b.id === result.id && b.sourceId === result.sourceId)
    if (existing) {
      if (onViewDetail) { onViewDetail(existing) } else { onRead(existing) }
      return
    }

    setLoadingBookId(result.id)
    try {
      if (result.sourceId === 'jisge' || result.sourceId === '') {
        try {
          const localResp = await fetch(`books/${result.id}.json`)
          if (localResp.ok) {
            const bookData = await localResp.json()
            const book: Book = {
              id: bookData.id || result.id, title: bookData.title || result.title,
              author: bookData.author || result.author || '未知', cover: bookData.cover || '',
              description: bookData.description || result.description || '',
              sourceId: bookData.sourceId || result.sourceId || 'jisge',
              sourceName: bookData.sourceName || result.sourceName || '集书阁',
              format: 'html', downloadUrl: bookData.chapters?.[0]?.url || '',
              chapters: (bookData.chapters || []).map((ch: any, i: number) => ({
                id: ch.id || `${result.id}-ch-${i}`, title: ch.title || '正文',
                index: i, url: ch.url || '', content: ch.content || '', cached: false
              })),
              cached: false
            }
            await saveBook(book); onAddBook(book)
            if (onViewDetail) { onViewDetail(book) } else { showToast(`已添加：${book.title}`) }
            setLoadingBookId(null); return
          }
        } catch {}
        try {
          const remoteResp = await fetch(`https://raw.githubusercontent.com/hugo-feng/yellow/gh-pages/books/${result.id}.json`, { signal: AbortSignal.timeout(8000), cache: 'no-cache' })
          if (remoteResp.ok) {
            const bookData = await remoteResp.json()
            const book: Book = {
              id: bookData.id || result.id, title: bookData.title || result.title,
              author: bookData.author || result.author || '未知', cover: bookData.cover || '',
              description: bookData.description || result.description || '',
              sourceId: bookData.sourceId || result.sourceId || 'jisge',
              sourceName: bookData.sourceName || result.sourceName || '集书阁',
              format: 'html', downloadUrl: bookData.chapters?.[0]?.url || '',
              chapters: (bookData.chapters || []).map((ch: any, i: number) => ({
                id: ch.id || `${result.id}-ch-${i}`, title: ch.title || '正文',
                index: i, url: ch.url || '', content: ch.content || '', cached: false
              })),
              cached: false
            }
            await saveBook(book); onAddBook(book)
            if (onViewDetail) { onViewDetail(book) } else { showToast(`已添加：${book.title}`) }
            setLoadingBookId(null); return
          }
        } catch {}
      }
      const book = await getBookContent(result.id, result.sourceId)
      if (!book.title || book.title === '未知书名') book.title = result.title || book.title
      if (!book.author || book.author === '未知作者' || book.author === '未知') book.author = result.author || book.author
      await saveBook(book); onAddBook(book)
      if (onViewDetail) { onViewDetail(book) } else { showToast(`已添加：${book.title}`) }
    } catch { showToast('获取书籍失败，请重试') }
    setLoadingBookId(null)
  }, [books, onAddBook, onRead, onViewDetail, showToast])

  const showHistory = !query.trim() && !loading && results.length === 0 && history.length > 0

  return (
    <div style={{ padding: 12 }}>
      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          ref={inputRef}
          className="input"
          type="text"
          placeholder="搜索书名、作者..."
          value={query}
          onChange={e => handleSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { if (searchTimeout.current) clearTimeout(searchTimeout.current); doSearch(query) } }}
        />
        {loading ? (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
          </div>
        ) : query ? (
          <button onClick={handleClear} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        ) : null}
      </div>

      {/* Search history */}
      {showHistory && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>搜索历史</span>
            <button onClick={clearHistory} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>清空</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {history.map(term => (
              <button key={term} onClick={() => handleHistoryClick(term)} className="btn btn-secondary btn-sm" style={{ fontSize: 12, padding: '5px 12px' }}>
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {localIndex.length > 0 && !query.trim() && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, padding: '0 4px' }}>
          {localIndex.length} 本本地缓存 · 21 个在线书源
        </div>
      )}

      {results.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, padding: '0 4px' }}>
          找到 {results.length} 个结果
        </div>
      )}

      {/* Empty state */}
      {!query.trim() && !loading && results.length === 0 && !showHistory && (
        <div className="empty-state" style={{ paddingTop: 60 }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <h3>搜索你喜欢的书</h3>
          <p style={{ marginTop: 4, fontSize: 13 }}>支持本地缓存书籍和在线书源搜索</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && results.length === 0 && (
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

      {/* No results */}
      {!loading && query.trim() && results.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 40 }}>
          <h3>未找到相关书籍</h3>
          <p style={{ marginTop: 4, fontSize: 13 }}>试试更换搜索词或检查网络连接</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {results.map((result, idx) => {
            const isAdded = books.some(b => b.id === result.id && b.sourceId === result.sourceId)
            const isLocal = result.sourceId === 'jisge'
            return (
              <div key={`${result.sourceId}-${result.id}`} className="card fade-in" style={{ display: 'flex', padding: 12, gap: 12, animationDelay: `${idx * 0.04}s` }}>
                <div style={{ width: 60, height: 80, borderRadius: 6, background: result.cover ? `url(${result.cover}) center/cover` : 'var(--bg-hover)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden' }}>
                  {!result.cover && result.title.slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{result.author}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    <span className="badge" style={{ fontSize: 10 }}>{result.sourceName}</span>
                    {isLocal && <span className="badge" style={{ background: 'rgba(76,175,132,0.15)', color: 'var(--success)', fontSize: 10 }}>离线可读</span>}
                    {isAdded && <span className="badge" style={{ background: 'rgba(76,175,132,0.15)', color: 'var(--success)', fontSize: 10 }}>已添加</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.description}</div>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={() => handleAddOrRead(result)} disabled={loadingBookId === result.id}>
                    {loadingBookId === result.id ? '加载中...' : isAdded ? '查看详情' : '添加到书架'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
