import { useState, useEffect, useCallback } from 'react'
import type { Book, TabKey, ReadingProgress, ReaderSettings } from './types'
import { getAllBooks, removeBook, saveProgress, getProgress } from './utils/db'
import { getCurrentVersion, checkForUpdates, getUpdateUrl } from './utils/updater'
import { ThemeProvider, useTheme } from './hooks/useTheme'
import Bookshelf from './components/Bookshelf'
import Discover from './components/Discover'
import SearchPage from './components/Search'
import Settings from './components/Settings'
import Reader from './components/Reader'
import BookDetail from './components/BookDetail'
import About from './components/About'

function AppInner() {
  const [activeTab, setActiveTab] = useState<TabKey>('discover')
  const [books, setBooks] = useState<Book[]>([])
  const [readingBook, setReadingBook] = useState<Book | null>(null)
  const [detailBook, setDetailBook] = useState<Book | null>(null)
  const [readingProgress, setReadingProgress] = useState<ReadingProgress | null>(null)
  const [showAbout, setShowAbout] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<{ version: string; description: string } | null>(null)
  const [currentVersion, setCurrentVersion] = useState('1.0.0')
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(() => {
    const saved = localStorage.getItem('reader-settings')
    return saved ? JSON.parse(saved) : { fontSize: 18, lineHeight: 1.8, theme: 'dark', fontFamily: 'system', maxWidth: 720 }
  })
  const [toast, setToast] = useState<string | null>(null)
  const { theme } = useTheme()

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }, [])

  const loadBooks = useCallback(async () => {
    try { setBooks(await getAllBooks()) } catch (e) { console.error(e) }
  }, [])

  // 启动自动检查 OTA 更新
  useEffect(() => {
    loadBooks()
    getCurrentVersion().then(v => setCurrentVersion(v))
    
    // 延迟 2 秒后自动检查更新
    const timer = setTimeout(async () => {
      try {
        const result = await checkForUpdates(getUpdateUrl())
        if (result.hasUpdate && result.version) {
          setUpdateInfo({ version: result.version, description: result.description || '' })
          setShowUpdateModal(true)
        } else if (result.error) {
          showToast(result.error)
        }
      } catch { showToast('更新检查失败') }
    }, 2000)
    return () => clearTimeout(timer)
  }, [loadBooks])

  useEffect(() => { localStorage.setItem('reader-settings', JSON.stringify(readerSettings)) }, [readerSettings])

  const handleReadBook = useCallback(async (book: Book) => {
    const progress = await getProgress(book.id)
    setReadingProgress(progress || null)
    setReadingBook(book)
  }, [])

  const handleCloseReader = useCallback((progress?: ReadingProgress) => {
    if (readingBook && progress) { saveProgress(progress); loadBooks() }
    setReadingBook(null); setReadingProgress(null)
  }, [readingBook, loadBooks])

  const handleDeleteBook = useCallback(async (bookId: string) => {
    await removeBook(bookId)
    setBooks(prev => prev.filter(b => b.id !== bookId))
    showToast('已从书架移除')
  }, [showToast])

  const handleAddBook = useCallback((book: Book) => {
    setBooks(prev => prev.find(b => b.id === book.id) ? prev : [book, ...prev])
  }, [])

  if (readingBook) {
    return (
      <Reader book={readingBook} initialProgress={readingProgress}
        settings={readerSettings} onSettingsChange={setReaderSettings}
        onClose={handleCloseReader} showToast={showToast} />
    )
  }

  if (detailBook) {
    return (
      <BookDetail
        book={detailBook}
        isInShelf={books.some(b => b.id === detailBook.id)}
        onAddToShelf={() => { handleAddBook(detailBook); setDetailBook(null) }}
        onStartRead={() => {
          if (!books.some(b => b.id === detailBook.id)) handleAddBook(detailBook)
          handleReadBook(detailBook)
          setDetailBook(null)
        }}
        onClose={() => setDetailBook(null)}
        showToast={showToast}
      />
    )
  }

  if (showAbout) {
    return (
      <About currentVersion={currentVersion} showToast={showToast}
        onClose={() => setShowAbout(false)} />
    )
  }

  return (
    <div className="app-container">
      <div className="header">
        <h1>Yellow</h1>
        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>v{currentVersion}</span>
      </div>

      <div className="page-content fade-in" key={activeTab}>
        {activeTab === 'discover' && (
          <Discover onViewDetail={setDetailBook} showToast={showToast} books={books} />
        )}
        {activeTab === 'bookshelf' && (
          <Bookshelf books={books} onRead={handleReadBook} onDelete={handleDeleteBook} onRefresh={loadBooks} />
        )}
        {activeTab === 'search' && (
          <SearchPage onAddBook={handleAddBook} onRead={handleReadBook} showToast={showToast} books={books} />
        )}
        {activeTab === 'settings' && (
          <Settings books={books} showToast={showToast} onOpenAbout={() => setShowAbout(true)} />
        )}
      </div>

      <div className="tab-bar">
        <TabBtn icon={<DiscoverIcon />} label="发现" active={activeTab === 'discover'} onClick={() => setActiveTab('discover')} />
        <TabBtn icon={<BookshelfIcon />} label="书架" active={activeTab === 'bookshelf'} onClick={() => setActiveTab('bookshelf')} />
        <TabBtn icon={<SearchIcon />} label="搜索" active={activeTab === 'search'} onClick={() => setActiveTab('search')} />
        <TabBtn icon={<SettingsIcon />} label="设置" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </div>

      {toast && <div className="toast scale-in">{toast}</div>}

      {/* OTA 更新弹窗 */}
      {showUpdateModal && updateInfo && (
        <div className="modal-overlay" onClick={() => setShowUpdateModal(false)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px' }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: 'var(--accent)' }}>
              发现新版本 v{updateInfo.version}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 6 }}>
              {updateInfo.description || '有新的功能和改进可用'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
              当前 v{currentVersion} → v{updateInfo.version}
            </p>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowUpdateModal(false)}>稍后提醒</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { 
                setShowUpdateModal(false)
                setShowAbout(true)
              }}>查看详情</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  )
}

function TabBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button className={`tab-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>
}

function DiscoverIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
}

function BookshelfIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
}

function SettingsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
}
