import { useState, useEffect, useCallback } from 'react'
import type { Book, TabKey, ReadingProgress, ReaderSettings } from './types'
import { getAllBooks, removeBook, saveProgress, getProgress } from './utils/db'
import { getCurrentVersion } from './utils/updater'
import Bookshelf from './components/Bookshelf'
import SearchPage from './components/Search'
import Settings from './components/Settings'
import Reader from './components/Reader'
import About from './components/About'

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('bookshelf')
  const [books, setBooks] = useState<Book[]>([])
  const [readingBook, setReadingBook] = useState<Book | null>(null)
  const [readingProgress, setReadingProgress] = useState<ReadingProgress | null>(null)
  const [showAbout, setShowAbout] = useState(false)
  const [currentVersion, setCurrentVersion] = useState('1.0.0')
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(() => {
    const saved = localStorage.getItem('reader-settings')
    return saved ? JSON.parse(saved) : { fontSize: 18, lineHeight: 1.8, theme: 'dark', fontFamily: 'system', maxWidth: 720 }
  })
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }, [])

  const loadBooks = useCallback(async () => {
    try { setBooks(await getAllBooks()) } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { loadBooks(); getCurrentVersion().then(v => setCurrentVersion(v)) }, [loadBooks])

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
      <Reader
        book={readingBook}
        initialProgress={readingProgress}
        settings={readerSettings}
        onSettingsChange={setReaderSettings}
        onClose={handleCloseReader}
        showToast={showToast}
      />
    )
  }

  if (showAbout) {
    return (
      <About
        currentVersion={currentVersion}
        showToast={showToast}
        onClose={() => setShowAbout(false)}
      />
    )
  }

  return (
    <div className="app-container">
      <div className="header">
        <h1>Yellow</h1>
        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>v{currentVersion}</span>
        <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>20书源</span>
      </div>

      <div className="page-content fade-in" key={activeTab}>
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
        <TabBtn icon={<BookshelfIcon />} label="书架" active={activeTab === 'bookshelf'} onClick={() => setActiveTab('bookshelf')} />
        <TabBtn icon={<SearchIcon />} label="搜索" active={activeTab === 'search'} onClick={() => setActiveTab('search')} />
        <TabBtn icon={<SettingsIcon />} label="设置" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </div>

      {toast && <div className="toast scale-in">{toast}</div>}
    </div>
  )
}

function TabBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`tab-item ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

function BookshelfIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
}

function SettingsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
}
