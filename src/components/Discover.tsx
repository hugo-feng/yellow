import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Book } from '../types'
import { hasInviteCode } from '../utils/invite'

interface DiscoverItem {
  id: string; title: string; author: string; cover: string; description: string
  sourceId: string; sourceName: string; url: string; tags?: string[]
}

interface Props {
  onViewDetail: (book: Book) => void
  showToast: (msg: string) => void
  books: Book[]
}

interface LocalBookIndex {
  id: string; title: string; author: string; cover?: string; sourceId: string; sourceName: string; description: string; tags?: string[]
}

const LOCAL_BOOKS_URL = 'books/index.json'
const REMOTE_BOOKS_URL = 'https://raw.githubusercontent.com/hugo-feng/yellow/gh-pages/books/index.json'

async function fetchBookIndex(): Promise<LocalBookIndex[]> {
  let index: LocalBookIndex[] = []

  try {
    const resp = await fetch(LOCAL_BOOKS_URL)
    if (resp.ok) index = await resp.json()
  } catch {}

  try {
    const remoteResp = await fetch(REMOTE_BOOKS_URL, { signal: AbortSignal.timeout(5000) })
    if (remoteResp.ok) {
      const remoteIndex: LocalBookIndex[] = await remoteResp.json()
      const existingIds = new Set(index.map(b => b.id))
      for (const book of remoteIndex) {
        if (!existingIds.has(book.id)) index.push(book)
      }
    }
  } catch {}

  return index
}

export default function Discover({ onViewDetail, showToast, books }: Props) {
  const [selectedCat, setSelectedCat] = useState('')
  const [shuffleKey, setShuffleKey] = useState(0)

  const { data: bookIndex = [], isLoading, error, refetch } = useQuery({
    queryKey: ['bookIndex'],
    queryFn: fetchBookIndex,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })

  const allTags = Array.from(new Set(bookIndex.flatMap(b => b.tags || [])))

  const filteredIndex = hasInviteCode() ? bookIndex : bookIndex.filter(b => b.sourceId !== 'jisge')

  const shuffled = useMemo(() => [...filteredIndex].sort(() => Math.random() - 0.5), [filteredIndex, shuffleKey])
  const recommended = selectedCat
    ? shuffled.filter(b => b.tags?.includes(selectedCat)).slice(0, 36)
    : shuffled.slice(0, 36)

  const tagSections = useMemo(() => allTags.slice(0, 6).map(tag => ({
    tag,
    books: shuffled.filter(b => b.tags?.includes(tag)).slice(0, 12)
  })).filter(s => s.books.length > 0), [allTags, shuffled])

  const toItems = (list: typeof bookIndex): DiscoverItem[] => list.map(b => ({
    id: b.id, title: b.title, author: b.author || '未知',
    cover: b.cover || '', description: b.description || '',
    sourceId: b.sourceId || 'jisge', sourceName: b.sourceName || '集书阁',
    url: '', tags: b.tags
  }))

  const handleClick = useCallback(async (item: DiscoverItem) => {
    const existing = books.find(b => b.id === item.id)
    if (existing) { onViewDetail(existing); return }

    try {
      let bookData: any = null
      try {
        const localResp = await fetch(`books/${item.id}.json`)
        if (localResp.ok) bookData = await localResp.json()
      } catch {}

      if (!bookData) {
        try {
          const remoteResp = await fetch(`https://raw.githubusercontent.com/hugo-feng/yellow/gh-pages/books/${item.id}.json`, {
            signal: AbortSignal.timeout(8000)
          })
          if (remoteResp.ok) bookData = await remoteResp.json()
        } catch {}
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
      {/* 分类标签 */}
      {allTags.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="section-title">分类标签</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 4 }}>
            {allTags.map(q => (
              <button
                key={q}
                onClick={() => setSelectedCat(prev => prev === q ? '' : q)}
                className={`btn btn-sm ${selectedCat === q ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 12, padding: '5px 14px', minWidth: 44, textAlign: 'center' }}
              >{q}</button>
            ))}
          </div>
        </div>
      )}

      {/* 推荐列表 */}
      <div className="section-title">
        {selectedCat ? `分类：${selectedCat}` : '为你推荐'}
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px' }} onClick={() => { setSelectedCat(''); setShuffleKey(k => k + 1) }}>
          换一换
        </button>
      </div>

      {isLoading && (
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

      {error && <div className="empty-state" style={{ paddingTop: 20 }}><h3>加载失败，请检查网络</h3></div>}

      {!isLoading && recommended.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 20 }}>
          <h3>{selectedCat ? `分类 "${selectedCat}" 暂无书籍` : '暂无预缓存书籍'}</h3>
        </div>
      )}

      {!isLoading && recommended.length > 0 && (
        <div className="discover-grid">
          {toItems(recommended).map((item, i) => (
            <div
              key={`${item.sourceId}-${item.id}`}
              className="discover-card fade-in"
              style={{ animationDelay: `${i * 0.03}s` }}
              onClick={() => handleClick(item)}
            >
              <div className="discover-cover" style={{ padding: 6, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: 1.3, wordBreak: 'break-all' }}>
                {item.cover ? (
                  <img src={item.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
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

      {/* 热门tag分类区块 */}
      {!selectedCat && !isLoading && tagSections.map(section => (
        <div key={section.tag} style={{ marginTop: 24 }}>
          <div className="section-title">{section.tag}</div>
          <div className="discover-grid">
            {toItems(section.books).map((item, i) => (
              <div
                key={`tag-${item.sourceId}-${item.id}`}
                className="discover-card fade-in"
                style={{ animationDelay: `${i * 0.03}s`, position: 'relative' }}
                onClick={() => handleClick(item)}
              >
                <div className="discover-cover" style={{ padding: 6, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: 1.3, wordBreak: 'break-all' }}>
                  {item.cover ? (
                    <img src={item.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  ) : (
                    <span style={{ fontSize: 12 }}>{item.title}</span>
                  )}
                </div>
                <div className="discover-info">
                  <div className="discover-title">{item.title}</div>
                  <div className="discover-author">{item.sourceName}</div>
                </div>
                <span style={{ position: 'absolute', top: 4, left: 4, background: 'var(--accent)', color: '#fff', fontSize: 9, padding: '2px 5px', borderRadius: 4, fontWeight: 600, lineHeight: 1.2 }}>{section.tag}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
