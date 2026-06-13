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

interface LocalBookIndex {
  id: string; title: string; author: string; sourceId: string; sourceName: string; description: string
}

export default function SearchPage({ onAddBook, onRead, showToast, books }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingBookId, setLoadingBookId] = useState<string | null>(null)
  const [localIndex, setLocalIndex] = useState<LocalBookIndex[]>([])
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  // 加载本地书籍索引
  useEffect(() => {
    fetch('books/index.json').then(r => r.json()).then((data: LocalBookIndex[]) => {
      setLocalIndex(data)
    }).catch(() => {})
  }, [])

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (!q.trim()) {
      setResults([])
      return
    }

    searchTimeout.current = setTimeout(async () => {
      setLoading(true)
      const allResults: SearchResult[] = []
      const seen = new Set<string>()

      // 1. 先搜索本地预缓存书籍
      if (localIndex.length > 0) {
        const kw = q.trim().toLowerCase()
        for (const book of localIndex) {
          if (book.title.toLowerCase().includes(kw) || book.description.toLowerCase().includes(kw) || book.author.toLowerCase().includes(kw)) {
            const key = `${book.sourceId}-${book.id}`
            if (!seen.has(key)) {
              seen.add(key)
              allResults.push({
                id: book.id,
                title: book.title,
                author: book.author || '未知',
                cover: '',
                description: book.description || '',
                sourceId: book.sourceId,
                sourceName: book.sourceName,
                format: 'html',
                downloadUrl: ''
              })
            }
          }
        }
      }

      // 2. 再搜索在线书源
      try {
        const onlineResults = await searchAcrossSources(q.trim())
        for (const r of onlineResults) {
          const key = `${r.sourceId}-${r.id}`
          if (!seen.has(key)) {
            seen.add(key)
            allResults.push(r)
          }
        }
      } catch { /* 在线搜索失败，仅展示本地结果 */ }

      setResults(allResults)
      setLoading(false)
    }, 400)
  }, [localIndex])

  const handleAddOrRead = useCallback(async (result: SearchResult) => {
    const existing = books.find(b => b.id === result.id && b.sourceId === result.sourceId)
    if (existing) {
      onRead(existing)
      return
    }

    setLoadingBookId(result.id)
    try {
      // 检查是否为本地预缓存书籍
      if (result.sourceId === 'jisge' || result.sourceId === '') {
        try {
          const localResp = await fetch(`books/${result.id}.json`)
          if (localResp.ok) {
            const bookData = await localResp.json()
            const book: Book = {
              id: bookData.id || result.id,
              title: bookData.title || result.title,
              author: bookData.author || result.author || '未知',
              cover: bookData.cover || '',
              description: bookData.description || result.description || '',
              sourceId: bookData.sourceId || result.sourceId || 'jisge',
              sourceName: bookData.sourceName || result.sourceName || '集书阁',
              format: 'html',
              downloadUrl: bookData.chapters?.[0]?.url || '',
              chapters: (bookData.chapters || []).map((ch: any, i: number) => ({
                id: ch.id || `${result.id}-ch-${i}`,
                title: ch.title || '正文',
                index: i,
                url: ch.url || '',
                content: ch.content || '',
                cached: false
              })),
              cached: false
            }
            await saveBook(book)
            onAddBook(book)
            showToast(`已添加：${book.title}`)
            setLoadingBookId(null)
            return
          }
        } catch { /* 本地没有，尝试远程OTA */ }

        // 尝试远程OTA
        try {
          const remoteResp = await fetch(`https://raw.githubusercontent.com/hugo-feng/yellow/gh-pages/books/${result.id}.json`, {
            signal: AbortSignal.timeout(8000),
            cache: 'no-cache'
          })
          if (remoteResp.ok) {
            const bookData = await remoteResp.json()
            const book: Book = {
              id: bookData.id || result.id,
              title: bookData.title || result.title,
              author: bookData.author || result.author || '未知',
              cover: bookData.cover || '',
              description: bookData.description || result.description || '',
              sourceId: bookData.sourceId || result.sourceId || 'jisge',
              sourceName: bookData.sourceName || result.sourceName || '集书阁',
              format: 'html',
              downloadUrl: bookData.chapters?.[0]?.url || '',
              chapters: (bookData.chapters || []).map((ch: any, i: number) => ({
                id: ch.id || `${result.id}-ch-${i}`,
                title: ch.title || '正文',
                index: i,
                url: ch.url || '',
                content: ch.content || '',
                cached: false
              })),
              cached: false
            }
            await saveBook(book)
            onAddBook(book)
            showToast(`已添加：${book.title}`)
            setLoadingBookId(null)
            return
          }
        } catch { /* OTA 也失败 */ }
      }

      // 回退到在线书源加载
      const book = await getBookContent(result.id, result.sourceId)
      await saveBook(book)
      onAddBook(book)
      showToast(`已添加：${book.title}`)
    } catch {
      showToast('获取书籍失败，请重试')
    }
    setLoadingBookId(null)
  }, [books, onAddBook, onRead, showToast])

  return (
    <div style={{ padding: 12 }}>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          className="input"
          type="text"
          placeholder="搜索书名、作者..."
          value={query}
          onChange={e => handleSearch(e.target.value)}
        />
        {loading && (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <div className="spinner" />
          </div>
        )}
      </div>

      {localIndex.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, padding: '0 4px' }}>
          {localIndex.length} 本本地缓存 · 21 个在线书源
        </div>
      )}

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
          <p style={{ marginTop: 4, fontSize: 13 }}>支持本地缓存书籍和在线书源搜索</p>
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
          <p style={{ marginTop: 4, fontSize: 13 }}>试试更换搜索词或检查网络连接</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {results.map((result, idx) => {
            const isAdded = books.some(b => b.id === result.id && b.sourceId === result.sourceId)
            const isLocal = result.sourceId === 'jisge'
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
                    {isLocal && (
                      <span className="badge" style={{ background: 'rgba(76,175,132,0.15)', color: 'var(--success)', fontSize: 10 }}>
                        离线可读
                      </span>
                    )}
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
    </div>
  )
}
