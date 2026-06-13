import { useState, useEffect, useCallback } from 'react'
import type { Book } from '../types'
import { saveBook } from '../utils/db'

interface DiscoverItem {
  id: string; title: string; author: string; cover: string; description: string
  sourceId: string; sourceName: string; url: string
}

interface Props {
  onAddBook: (book: Book) => void
  onRead: (book: Book) => void
  showToast: (msg: string) => void
  books: Book[]
}

// 热门搜索关键词，用于各源发现内容
const HOT_QUERIES = ['玄幻', '都市', '穿越', '重生', '系统', '修仙', '武侠', '言情', '悬疑', '网游', '末日', '神医']

export default function Discover({ onAddBook, onRead, showToast, books }: Props) {
  const [hotBooks, setHotBooks] = useState<DiscoverItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedQuery, setSelectedQuery] = useState('')

  const fetchDiscover = useCallback(async () => {
    setLoading(true)
    setError('')
    const query = selectedQuery || HOT_QUERIES[Math.floor(Math.random() * HOT_QUERIES.length)]
    
    try {
      // 从集书阁获取分类列表作为推荐
      const urls = [
        `https://26b.jisge.com/list-${encodeURI(query)}.html`,
      ]
      
      const results: DiscoverItem[] = []
      for (const url of urls) {
        try {
          const resp = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(8000)
          })
          if (!resp.ok) continue
          const html = await resp.text()
          const doc = new DOMParser().parseFromString(html, 'text/html')
          
          const items = doc.querySelectorAll('ul.ucontent li a')
          items.forEach(a => {
            const titleEl = a.querySelector('.title')
            const descEl = a.querySelector('.description')
            const href = a.getAttribute('href') || ''
            const title = titleEl?.textContent?.trim() || ''
            if (title && href && results.length < 30) {
              results.push({
                id: href.replace(/^\//, '').replace(/\.html$/, ''),
                title,
                author: '',
                cover: '',
                description: descEl?.textContent?.trim() || '',
                sourceId: 'jisge',
                sourceName: '集书阁',
                url: href
              })
            }
          })
        } catch { /* skip failed source */ }
      }

      if (results.length === 0) {
        // 回退：用 biqugu 源获取推荐
        try {
          const resp = await fetch(`https://www.xbiqugu.com/search?keyword=${encodeURIComponent(query)}`, {
            signal: AbortSignal.timeout(8000)
          })
          if (resp.ok) {
            const html = await resp.text()
            const doc = new DOMParser().parseFromString(html, 'text/html')
            doc.querySelectorAll('.result-item, ul li a').forEach(a => {
              const link = a.querySelector('a') || a
              const href = link.getAttribute('href') || ''
              const title = link.querySelector('h3, .title')?.textContent?.trim() || link.textContent?.trim() || ''
              if (title && href && results.length < 30) {
                results.push({
                  id: href.replace(/^\//, '').replace(/\/$/, '').replace(/\//g, '_'),
                  title, author: '', cover: '',
                  description: '',
                  sourceId: 'xbiqugu', sourceName: '香书小说', url: href
                })
              }
            })
          }
        } catch { /* skip */ }
      }

      setHotBooks(results)
      if (results.length === 0) setError('暂无推荐，请尝试搜索')
    } catch {
      setError('加载失败，请检查网络')
    }
    setLoading(false)
  }, [selectedQuery])

  useEffect(() => { fetchDiscover() }, [fetchDiscover])

  const handleAdd = useCallback(async (item: DiscoverItem) => {
    const existing = books.find(b => b.id === item.id)
    if (existing) { onRead(existing); return }
    
    try {
      const { allSources } = await import('../utils/sources')
      const source = allSources[item.sourceId]
      if (source) {
        const book = await source.getBookDetail(item.id)
        await saveBook(book)
        onAddBook(book)
        showToast(`已添加：${book.title}`)
      }
    } catch { showToast('添加失败') }
  }, [books, onAddBook, onRead, showToast])

  return (
    <div style={{ padding: 12 }}>
      {/* 分类快捷入口 */}
      <div style={{ marginBottom: 16 }}>
        <div className="section-title">热门分类</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {HOT_QUERIES.map(q => (
            <button
              key={q}
              onClick={() => { setSelectedQuery(prev => prev === q ? '' : q); fetchDiscover() }}
              className={`btn btn-sm ${selectedQuery === q ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12, padding: '5px 12px' }}
            >{q}</button>
          ))}
        </div>
      </div>

      {/* 推荐列表 */}
      <div className="section-title">
        为你推荐
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px' }} onClick={fetchDiscover}>
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

      {!loading && hotBooks.length > 0 && (
        <div className="discover-grid">
          {hotBooks.map((item, i) => (
            <div
              key={`${item.sourceId}-${item.id}`}
              className="discover-card fade-in"
              style={{ animationDelay: `${i * 0.03}s` }}
              onClick={() => handleAdd(item)}
            >
              <div className="discover-cover">
                {item.cover ? (
                  <img src={item.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span>{item.title.slice(0, 3)}</span>
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
