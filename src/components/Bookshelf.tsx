import type { Book } from '../types'

interface Props {
  books: Book[]
  onRead: (book: Book) => void
  onDelete: (bookId: string) => void
  onRefresh: () => void
}

export default function Bookshelf({ books, onRead, onDelete, onRefresh }: Props) {
  if (books.length === 0) {
    return (
      <div className="empty-state" style={{ paddingTop: 80 }}>
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="8" y1="7" x2="16" y2="7" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
        <h3>书架空空如也</h3>
        <p style={{ marginTop: 4, fontSize: 13 }}>去「搜索」页面发现好书吧</p>
        <button
          className="btn btn-primary"
          style={{ marginTop: 20 }}
          onClick={onRefresh}
        >
          刷新书架
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          padding: '0 4px'
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          共 {books.length} 本书
        </span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
        >
          刷新
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {books.map((book, index) => (
          <div
            key={book.id}
            className="card fade-in"
            style={{
              display: 'flex',
              padding: 12,
              gap: 12,
              animationDelay: `${index * 0.05}s`
            }}
          >
            <div
              style={{
                width: 70,
                height: 95,
                borderRadius: 6,
                background: book.cover
                  ? `url(${book.cover}) center/cover`
                  : 'var(--bg-hover)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: 11,
              overflow: 'hidden',
              padding: 4,
              textAlign: 'center',
              lineHeight: 1.3,
              wordBreak: 'break-all'
            }}
          >
            {!book.cover && <span style={{ fontSize: 11 }}>{book.title}</span>}
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {book.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {book.author}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  <span className="badge">{book.sourceName}</span>
                  {book.chapters.length > 0 && (
                    <span className="badge" style={{ background: 'rgba(76,175,132,0.15)', color: 'var(--success)' }}>
                      {book.chapters.length}章
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => onRead(book)}
                >
                  阅读
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ padding: '6px 10px', fontSize: 12 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(book.id)
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
