import { useState, useEffect } from 'react'
import type { Book, Chapter } from '../types'
import { getBookChapters } from '../utils/db'

interface Props {
  book: Book
  isInShelf: boolean
  onAddToShelf: () => void
  onStartRead: () => void
  onClose: () => void
  showToast: (msg: string) => void
  cacheBook?: (book: Book) => void
  cacheTask?: { bookId: string; title: string; progress: number; current: number; total: number } | null
}

export default function BookDetail({ book, isInShelf, onAddToShelf, onStartRead, onClose, showToast, cacheBook, cacheTask }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [cached, setCached] = useState(false)

  const chapters = book.chapters || []
  const showChapters = chapters.length > 1
  const displayChapters = expanded ? chapters : chapters.slice(0, 20)
  const isCaching = cacheTask && cacheTask.bookId === book.id

  // Check if book is already cached on mount
  useEffect(() => {
    if (chapters.length === 0) return
    getBookChapters(book.id).then(cachedChapters => {
      const cachedCount = cachedChapters.filter(c => c.cached).length
      if (cachedCount >= chapters.length) setCached(true)
    }).catch(() => {})
  }, [book.id, chapters.length])

  const handleAdd = () => {
    onAddToShelf()
    showToast(`已加入书架：${book.title}`)
  }

  const handleCache = () => {
    if (cached || isCaching || !cacheBook) return
    cacheBook(book)
  }

  // Check if cache completed (in useEffect to avoid duplicate toasts)
  useEffect(() => {
    if (isCaching && cacheTask!.progress >= 100 && !cached) {
      setCached(true)
    }
  }, [isCaching, cacheTask, cached])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <div className="header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer', padding: 0, display: 'flex' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          书籍详情
        </h1>
      </div>

      <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
        {/* 书籍信息 */}
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <div
            style={{
              width: 110, height: 150, borderRadius: 8, margin: '0 auto 16px',
              background: book.cover ? `url(${book.cover}) center/cover` : 'var(--bg-hover)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: 14
            }}
          >
            {!book.cover && <span style={{ padding: 4, textAlign: 'center', lineHeight: 1.3 }}>{book.title}</span>}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{book.title}</h2>
          {book.author && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{book.author}</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="badge">{book.sourceName}</span>
            {chapters.length > 0 && (
              <span className="badge" style={{ background: 'rgba(100,149,237,0.15)', color: '#8888cc' }}>{chapters.length} 章</span>
            )}
          </div>
        </div>

        {/* 简介 */}
        {book.description && (
          <div style={{ padding: '0 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>简介</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{book.description}</div>
          </div>
        )}

        {/* 标签 */}
        <div style={{ padding: '0 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {generateTags(book).map(tag => (
              <span key={tag} className="badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={{ padding: '0 16px', marginBottom: 20, display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={onStartRead}
          >
            开始阅读
          </button>
          {!isInShelf && (
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={handleAdd}
            >
              加入书架
            </button>
          )}
          {cacheBook && (
            <button
              className={cached ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ flex: 1, position: 'relative', opacity: cached ? 0.7 : 1 }}
              onClick={handleCache}
              disabled={!!isCaching || cached}
            >
              {cached ? '已缓存' : isCaching ? `缓存中 ${cacheTask!.progress}%` : '缓存'}
            </button>
          )}
        </div>

        {/* 目录 */}
        {showChapters && (
          <div style={{ padding: '0 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              目录（共{chapters.length}章）
            </div>
            <div className="card" style={{ maxHeight: 400, overflow: 'auto' }}>
              {displayChapters.map((ch, i) => (
                <div
                  key={ch.id}
                  style={{
                    padding: '12px 14px',
                    borderBottom: i < displayChapters.length - 1 ? '1px solid var(--border)' : 'none',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 24 }}>{i + 1}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.title}</span>
                </div>
              ))}
              {chapters.length > 20 && (
                <button
                  style={{
                    width: '100%', padding: '12px', border: 'none', borderTop: '1px solid var(--border)',
                    background: 'var(--bg-hover)', color: 'var(--accent)', fontSize: 13, cursor: 'pointer'
                  }}
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? `收起（共${chapters.length}章）` : `展开全部（共${chapters.length}章）`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 书籍信息 */}
        <div style={{ padding: '0 16px', marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>书籍信息</div>
          <div className="card">
            <InfoRow label="书名" value={book.title} />
            <InfoRow label="作者" value={book.author || '未知'} />
            <InfoRow label="来源" value={book.sourceName} />
            <InfoRow label="章节数" value={String(chapters.length)} isLast />
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 14px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)'
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  )
}

function generateTags(book: Book): string[] {
  const text = `${book.title} ${book.description || ''}`
  const tags: string[] = []
  const tagMap: [RegExp, string][] = [
    [/短篇|小品/, '短篇'],
    [/校园|同学|老师|学生/, '校园'],
    [/家庭|爸爸|妈妈|哥哥|姐姐|弟弟|妹妹|公公|儿媳|嫂嫂|侄女/, '家庭'],
    [/青春|少女|少年/, '青春'],
    [/都市|城市/, '都市'],
    [/悬疑|推理/, '悬疑'],
    [/穿越|重生/, '穿越'],
    [/武侠|修仙|玄幻/, '玄幻'],
    [/言情|恋爱|爱情/, '言情'],
    [/职场|工作/, '职场'],
    [/情感|浪漫/, '情感'],
  ]
  for (const [re, tag] of tagMap) {
    if (re.test(text) && !tags.includes(tag)) tags.push(tag)
  }
  if (tags.length === 0) tags.push('小说')
  return tags.slice(0, 5)
}
