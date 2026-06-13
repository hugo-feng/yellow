import { useState, useEffect, useCallback, useRef, Component } from 'react'
import type { Book, TabKey, ReadingProgress, ReaderSettings } from './types'
import { getAllBooks, removeBook, saveProgress, getProgress, saveBook, saveChapter, getChapter } from './utils/db'
import { getCurrentVersion, checkForUpdates, getUpdateUrl, waitSWReady } from './utils/updater'
import { ThemeProvider, useTheme } from './hooks/useTheme'
import { App as CapApp } from '@capacitor/app'
import Bookshelf from './components/Bookshelf'
import Discover from './components/Discover'
import SearchPage from './components/Search'
import Settings from './components/Settings'
import Reader from './components/Reader'
import BookDetail from './components/BookDetail'
import About from './components/About'
import CacheManager from './components/CacheManager'

interface CacheTask {
  bookId: string; title: string; progress: number; current: number; total: number
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(err: Error) { return { error: err.message } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a', color: '#e8e8f0', padding: 24, textAlign: 'center' }}>
          <h2 style={{ color: '#f0c040', marginBottom: 12 }}>出现错误</h2>
          <p style={{ color: '#9a9ab0', fontSize: 13, marginBottom: 20 }}>{this.state.error}</p>
          <button onClick={() => { localStorage.clear(); window.location.reload() }}
            style={{ background: '#f0c040', color: '#1a1a2e', border: 'none', padding: '10px 24px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            清除数据并重启
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function AppInner() {
  const [activeTab, setActiveTab] = useState<TabKey>('discover')
  const [books, setBooks] = useState<Book[]>([])
  const [readingBook, setReadingBook] = useState<Book | null>(null)
  const [detailBook, setDetailBook] = useState<Book | null>(null)
  const [readingProgress, setReadingProgress] = useState<ReadingProgress | null>(null)
  const [showAbout, setShowAbout] = useState(false)
  const [showCacheManager, setShowCacheManager] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<{ version: string; description: string } | null>(null)
  const [showOtaSuccess, setShowOtaSuccess] = useState(false)
  const [otaNewVersion, setOtaNewVersion] = useState('')
  const [cacheTask, setCacheTask] = useState<CacheTask | null>(null)
  const [currentVersion, setCurrentVersion] = useState('1.0.0')
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(() => {
    const defaults: ReaderSettings = { fontSize: 18, lineHeight: 1.8, theme: 'dark', fontFamily: 'system', maxWidth: 720, brightness: 100, paragraphSpacing: 1.2 }
    try {
      const saved = localStorage.getItem('reader-settings')
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults
    } catch { return defaults }
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

  useEffect(() => {
    loadBooks()
    // 等 SW 就绪后再读版本 + 检查更新
    waitSWReady().then(async () => {
      await getCurrentVersion().then(v => setCurrentVersion(v))
      try {
        const result = await checkForUpdates(getUpdateUrl())
        if (result.hasUpdate && result.version) {
          setUpdateInfo({ version: result.version, description: result.description || '' })
          setShowUpdateModal(true)
        }
      } catch { /* 静默 */ }
    })
  }, [loadBooks])

  useEffect(() => { localStorage.setItem('reader-settings', JSON.stringify(readerSettings)) }, [readerSettings])

  // Android 系统返回手势：二级页面返回而非退出 App
  const pushedRef = useRef(false)
  const hasSubPage = readingBook || detailBook || showAbout || showCacheManager
  useEffect(() => {
    if (hasSubPage && !pushedRef.current) {
      history.pushState({ sub: true }, '')
      pushedRef.current = true
    }
    if (!hasSubPage) pushedRef.current = false
  }, [hasSubPage])

  useEffect(() => {
    const goBack = () => {
      if (readingBook) { handleCloseReader(); return true }
      if (detailBook) { setDetailBook(null); return true }
      if (showAbout) { setShowAbout(false); return true }
      if (showCacheManager) { setShowCacheManager(false); return true }
      return false
    }

    const onPopState = () => { goBack() }
    window.addEventListener('popstate', onPopState)

    const capListener = CapApp.addListener('backButton', () => {
      if (!goBack()) CapApp.exitApp()
    })

    return () => {
      window.removeEventListener('popstate', onPopState)
      capListener.then(l => l.remove())
    }
  }, [readingBook, detailBook, showAbout, showCacheManager])

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

  const cacheBook = useCallback(async (book: Book) => {
    if (cacheTask) { showToast('已有缓存任务进行中'); return }
    const chapters = book.chapters || []
    if (chapters.length === 0) { showToast('无可缓存内容'); return }

    if (!books.find(b => b.id === book.id)) handleAddBook(book)

    setCacheTask({ bookId: book.id, title: book.title, progress: 0, current: 0, total: chapters.length })

    try {
      await saveBook({ ...book, cached: true })

      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i]
        setCacheTask(prev => prev ? { ...prev, current: i + 1, progress: Math.round(((i + 1) / chapters.length) * 100) } : null)

        if (ch.content) {
          await saveChapter({ ...ch, id: `${book.id}-ch-${ch.index}`, cached: true })
          continue
        }

        const existing = await getChapter(`${book.id}-ch-${ch.index}`)
        if (existing?.content) continue

        try {
          if (ch.url) {
            const resp = await fetch(ch.url)
            if (resp.ok) {
              const text = await resp.text()
              const bodyMatch = text.match(/<div[^>]*id="bookcontent"[^>]*>([\s\S]*?)<\/div>/i)
              let content = ''
              if (bodyMatch) {
                content = bodyMatch[1].replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
              } else {
                const pMatches = text.match(/<p[^>]*>([\s\S]*?)<\/p>/gi)
                content = pMatches ? pMatches.map(p => p.replace(/<[^>]+>/g, '').trim()).filter(Boolean).join('\n\n') : text.replace(/<[^>]+>/g, '').trim()
              }
              if (content) {
                await saveChapter({ ...ch, id: `${book.id}-ch-${ch.index}`, content, cached: true })
              }
            }
          }
        } catch { /* skip */ }
      }

      showToast(`"${book.title}" 已缓存完成`)
      loadBooks()
    } catch {
      showToast('缓存失败')
    } finally {
      setCacheTask(null)
    }
  }, [cacheTask, books, handleAddBook, showToast, loadBooks])

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
        cacheBook={cacheBook}
        cacheTask={cacheTask}
      />
    )
  }

  if (showAbout) {
    return (
      <About currentVersion={currentVersion} showToast={showToast}
        onClose={() => setShowAbout(false)}
        onOtaSuccess={(v) => { setOtaNewVersion(v); setShowOtaSuccess(true); setShowAbout(false) }} />
    )
  }

  if (showCacheManager) {
    return (
      <CacheManager
        onClose={() => setShowCacheManager(false)}
        showToast={showToast}
        cacheTask={cacheTask}
      />
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
          <Settings books={books} showToast={showToast} onOpenAbout={() => setShowAbout(true)}
            cacheTask={cacheTask} onOpenCacheManager={() => setShowCacheManager(true)} />
        )}
      </div>

      <div className="tab-bar">
        <TabBtn icon={<DiscoverIcon />} label="发现" active={activeTab === 'discover'} onClick={() => setActiveTab('discover')} />
        <TabBtn icon={<BookshelfIcon />} label="书架" active={activeTab === 'bookshelf'} onClick={() => setActiveTab('bookshelf')} />
        <TabBtn icon={<SearchIcon />} label="搜索" active={activeTab === 'search'} onClick={() => setActiveTab('search')} />
        <TabBtn icon={<SettingsIcon />} label="设置" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </div>

      {toast && <div className="toast scale-in">{toast}</div>}

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

      {showOtaSuccess && (
        <div className="modal-overlay" onClick={() => setShowOtaSuccess(false)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px' }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(76,175,132,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4caf84" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: 'var(--success)' }}>更新完成</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20 }}>已更新至 v{otaNewVersion}，重启后生效</p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setShowOtaSuccess(false); window.location.reload() }}>立即重启</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppInner />
      </ThemeProvider>
    </ErrorBoundary>
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
