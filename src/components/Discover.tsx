import { useState, useEffect, useCallback } from 'react'
import type { Book, Chapter } from '../types'

interface DiscoverItem {
  id: string; title: string; author: string; cover: string; description: string
  sourceId: string; sourceName: string; url: string
}

interface Props {
  onViewDetail: (book: Book) => void
  showToast: (msg: string) => void
  books: Book[]
}

interface LocalBookIndex {
  id: string; title: string; author: string; sourceId: string; sourceName: string; description: string
  tags?: string[]
}

const LOCAL_BOOKS_URL = 'books/index.json'
const REMOTE_BOOKS_URL = 'https://raw.githubusercontent.com/hugo-feng/yellow/gh-pages/books/index.json'



export default function Discover({ onViewDetail, showToast, books }: Props) {
  const [localBooks, setLocalBooks] = useState<DiscoverItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [allTags, setAllTags] = useState<string[]>([])

  const fetchLocalBooks = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let index: LocalBookIndex[] = []

      // 优先从本地加载
      try {
        const resp = await fetch(LOCAL_BOOKS_URL)
        if (resp.ok) {
          index = await resp.json()
        }
      } catch { /* 本地加载失败，尝试远程 */ }

      // 从远程 OTA 加载（可能有新增书籍）
      try {
        const remoteResp = await fetch(REMOTE_BOOKS_URL, { 
          signal: AbortSignal.timeout(5000),
          cache: 'no-cache' 
        })
        if (remoteResp.ok) {
          const remoteIndex: LocalBookIndex[] = await remoteResp.json()
          // 合并远程数据（以本地为主，远程补充新书）
          const existingIds = new Set(index.map(b => b.id))
          for (const book of remoteIndex) {
            if (!existingIds.has(book.id)) {
              index.push(book)
            }
          }
        }
      } catch { /* 远程不可达，仅用本地 */ }

      // 提取所有唯一tag
      setAllTags(Array.from(new Set(index.flatMap(b => b.tags || []))))

      // 按tag筛选
      let filtered = index
      if (selectedCat) {
        filtered = index.filter(b => b.tags?.includes(selectedCat))
      }

      const items: DiscoverItem[] = filtered.map(b => ({
        id: b.id,
        title: b.title,
        author: b.author || '未知',
        cover: '',
        description: b.description || '',
        sourceId: b.sourceId || 'jisge',
        sourceName: b.sourceName || '集书阁',
        url: ''
      }))

      setLocalBooks(items)
      if (items.length === 0 && selectedCat) {
        setError(`分类 "${selectedCat}" 暂无书籍`)
      } else if (items.length === 0) {
        setError('暂无预缓存书籍，请检查网络后搜索')
      }
    } catch {
      setError('加载失败，请检查网络')
    }
    setLoading(false)
  }, [selectedCat])

  useEffect(() => { fetchLocalBooks() }, [fetchLocalBooks])

  const handleClick = useCallback(async (item: DiscoverItem) => {
    // 检查是否已在书架中
    const existing = books.find(b => b.id === item.id)
    if (existing) {
      onViewDetail(existing)
      return
    }
    
    try {
      // 优先从本地加载书籍内容
      let bookData: any = null
      try {
        const localResp = await fetch(`books/${item.id}.json`)
        if (localResp.ok) {
          bookData = await localResp.json()
        }
      } catch { /* fallback */ }

      // 本地没有则从远程 OTA 加载
      if (!bookData) {
        try {
          const remoteResp = await fetch(`https://raw.githubusercontent.com/hugo-feng/yellow/gh-pages/books/${item.id}.json`, {
            signal: AbortSignal.timeout(8000),
            cache: 'no-cache'
          })
          if (remoteResp.ok) {
            bookData = await remoteResp.json()
          }
        } catch { /* fallback */ }
      }

      if (bookData) {
        const book: Book = {
          id: bookData.id || item.id,
          title: bookData.title || item.title,
          author: bookData.author || item.author || '未知',
          cover: bookData.cover || '',
          description: bookData.description || item.description || '',
          sourceId: bookData.sourceId || item.sourceId,
          sourceName: bookData.sourceName || item.sourceName,
          format: 'html',
          downloadUrl: bookData.chapters?.[0]?.url || '',
          chapters: (bookData.chapters || []).map((ch: any, i: number) => ({
            id: ch.id || `${item.id}-ch-${i}`,
            title: ch.title || '正文',
            index: i,
            url: ch.url || '',
            content: ch.content || '',
            cached: false
          })),
          cached: false
        }
        onViewDetail(book)
        return
      }

      showToast('加载失败，请检查网络')
    } catch { showToast('加载失败') }
  }, [books, onViewDetail, showToast])

  return (
    <div style={{ padding: 12 }}>
      {/* 分类快捷入口 */}
      <div style={{ marginBottom: 16 }}>
        <div className="section-title">分类标签</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {allTags.map(q => (
            <button
              key={q}
              onClick={() => setSelectedCat(prev => prev === q ? '' : q)}
              className={`btn btn-sm ${selectedCat === q ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12, padding: '5px 12px' }}
            >{q}</button>
          ))}
        </div>
      </div>

      {/* 推荐列表 */}
      <div className="section-title">
        为你推荐
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px' }} onClick={() => { setSelectedCat(''); fetchLocalBooks() }}>
          换一换
        </button>
      </div>

      {loading && (
        <div className="discover-grid">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="discover-card">
              <div className="discover-cover skeleton" />
              <div className="discover-info">
                <div className="skeleton" style={{ height: 14, width: '80%', marginBottom: 4 }} />
                <div className="skeleton" style={{ height: 10, width: '50%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="empty-state" style={{ paddingTop: 20 }}><h3>{error}</h3></div>}

      {!loading && localBooks.length > 0 && (
        <div className="discover-grid">
          {localBooks.map((item, i) => (
            <div
              key={`${item.sourceId}-${item.id}`}
              className="discover-card fade-in"
              style={{ animationDelay: `${i * 0.03}s` }}
              onClick={() => handleClick(item)}
            >
              <div className="discover-cover" style={{ padding: 6, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: 1.3, wordBreak: 'break-all' }}>
                {item.cover ? (
                  <img src={item.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 12 }}>{item.title}</span>
                )}
              </div>
              <div className="discover-info">
                <div className="discover-title">{item.title}</div>
                <div className="discover-author">{item.sourceName}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
