import { useState, useEffect, useCallback, useRef } from 'react'
import type { Book, Chapter, ReaderSettings, ReadingProgress } from '../types'
import { saveChapter, getChapter, saveProgress, getBookChapters, saveBook } from '../utils/db'
import { getBookContent } from '../utils/sources'

interface Props {
  book: Book
  initialProgress: ReadingProgress | null
  settings: ReaderSettings
  onSettingsChange: (settings: ReaderSettings) => void
  onClose: (progress?: ReadingProgress) => void
  showToast: (msg: string) => void
}

export default function Reader({ book, initialProgress, settings, onSettingsChange, onClose, showToast }: Props) {
  const [currentChapterIdx, setCurrentChapterIdx] = useState(initialProgress?.chapterIndex ?? 0)
  const [scrollPos, setScrollPos] = useState(initialProgress?.scrollPosition ?? 0)
  const [showControls, setShowControls] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const controlsTimer = useRef<ReturnType<typeof setTimeout>>()
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const [isSwiping, setIsSwiping] = useState(false)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageOffsets, setPageOffsets] = useState<number[]>([0])
  const [measured, setMeasured] = useState(false)

  const currentChapter = book.chapters[currentChapterIdx]
  const hasPrev = currentChapterIdx > 0
  const hasNext = currentChapterIdx < book.chapters.length - 1
  const isSwipeMode = settings.pageMode === 'swipe'
  const pageCount = pageOffsets.length

  const loadChapterContent = useCallback(async (chapter: Chapter) => {
    if (chapter.content) return chapter.content
    const cached = await getChapter(`${book.id}-ch-${chapter.index}`)
    if (cached?.content) {
      chapter.content = cached.content
      return cached.content
    }
    return null
  }, [book.id])

  const ensureContent = useCallback(async () => {
    if (!currentChapter) return
    setLoading(true)
    let content = await loadChapterContent(currentChapter)
    if (!content) {
      try {
        const fullBook = await getBookContent(book.id, book.sourceId)
        if (fullBook.chapters.length > 0) {
          book.chapters = fullBook.chapters
          content = fullBook.chapters[0].content || ''
          if (content) {
            const ch: Chapter = { ...fullBook.chapters[0], id: `${book.id}-ch-0` }
            await saveChapter(ch)
          }
        }
      } catch {
        showToast('加载内容失败')
        content = '加载失败，请检查网络后重试。'
      }
    }
    if (content && !currentChapter.content) {
      currentChapter.content = content
    }
    setLoading(false)
  }, [currentChapter, book, loadChapterContent, showToast])

  useEffect(() => { ensureContent() }, [currentChapterIdx])

  useEffect(() => {
    if (contentRef.current && scrollPos > 0 && !isSwipeMode) {
      contentRef.current.scrollTop = scrollPos
    }
  }, [currentChapterIdx])

  const toggleControls = useCallback(() => {
    setShowControls(prev => !prev)
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
    if (!showControls) {
      controlsTimer.current = setTimeout(() => setShowControls(false), 4000)
    }
  }, [showControls])

  const handlePrevChapter = useCallback(() => {
    if (hasPrev) {
      setCurrentChapterIdx(prev => prev - 1)
      setScrollPos(0)
      setCurrentPage(0)
      setMeasured(false)
    }
  }, [hasPrev])

  const handleNextChapter = useCallback(() => {
    if (hasNext) {
      setCurrentChapterIdx(prev => prev + 1)
      setScrollPos(0)
      setCurrentPage(0)
      setMeasured(false)
    }
  }, [hasNext])

  const handleClose = useCallback(() => {
    const contentEl = contentRef.current
    const progress: ReadingProgress = {
      bookId: book.id,
      chapterIndex: currentChapterIdx,
      scrollPosition: contentEl?.scrollTop ?? scrollPos,
      updatedAt: Date.now()
    }
    onClose(progress)
  }, [book.id, currentChapterIdx, scrollPos, onClose])

  const changeSetting = useCallback(<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }, [settings, onSettingsChange])

  const themeColors = {
    dark: { bg: '#0f0f1a', text: '#d8d8e0', border: '#2a2a45' },
    light: { bg: '#f5f5f0', text: '#1a1a1a', border: '#ddd' },
    sepia: { bg: '#f4ecd8', text: '#4a3728', border: '#d4c5a0' }
  } as const
  const theme = themeColors[settings.theme]

  const fontFamilyMap: Record<string, string> = {
    system: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
    serif: 'Georgia, "Times New Roman", "Songti SC", serif',
    mono: '"SF Mono", "Fira Code", "Courier New", monospace'
  }

  const paragraphs = currentChapter?.content
    ? currentChapter.content.replace(/\r\n/g, '\n').split('\n').filter(p => p.trim())
    : []

  useEffect(() => {
    if (!isSwipeMode || paragraphs.length === 0) { setPageOffsets([0]); setMeasured(true); return }
    const el = contentRef.current
    if (!el) return
    const containerH = el.clientHeight
    if (containerH <= 0) return
    const paraEls = el.querySelectorAll('p[data-page-para]')
    if (paraEls.length === 0) return
    const offsets: number[] = [0]
    let usedH = 0
    paraEls.forEach((pEl, i) => {
      const pH = pEl.getBoundingClientRect().height
      if (usedH + pH > containerH && i > 0) {
        const prevEl = paraEls[i - 1] as HTMLElement
        offsets.push(prevEl.offsetTop + prevEl.offsetHeight)
        usedH = pH
      } else {
        usedH += pH
      }
    })
    setPageOffsets(offsets.length > 0 ? offsets : [0])
    setMeasured(true)
  }, [isSwipeMode, paragraphs, settings.fontSize, settings.lineHeight, settings.paragraphSpacing, settings.maxWidth, currentChapterIdx, loading])

  useEffect(() => {
    if (currentPage >= pageOffsets.length) setCurrentPage(Math.max(0, pageOffsets.length - 1))
  }, [pageOffsets])

  const goToPage = useCallback((page: number) => {
    if (page < 0) {
      if (hasPrev) { handlePrevChapter(); setCurrentPage(9999) }
    } else if (page >= pageCount) {
      if (hasNext) { handleNextChapter(); setCurrentPage(0) }
    } else {
      setCurrentPage(page)
    }
  }, [pageCount, hasNext, hasPrev, handleNextChapter, handlePrevChapter])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isSwipeMode) return
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() }
    setIsSwiping(true)
  }, [isSwipeMode])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !isSwipeMode) return
    const dx = e.touches[0].clientX - touchStartRef.current.x
    const dy = e.touches[0].clientY - touchStartRef.current.y
    if (Math.abs(dx) > Math.abs(dy)) setSwipeOffset(dx)
  }, [isSwipeMode])

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !isSwipeMode) return
    const elapsed = Date.now() - touchStartRef.current.time
    const velocity = Math.abs(swipeOffset) / (elapsed || 1) * 1000
    if (swipeOffset < -60 || (swipeOffset < -20 && velocity > 200)) {
      goToPage(currentPage + 1)
    } else if (swipeOffset > 60 || (swipeOffset > 20 && velocity > 200)) {
      goToPage(currentPage - 1)
    }
    setIsSwiping(false)
    setSwipeOffset(0)
    touchStartRef.current = null
  }, [swipeOffset, isSwipeMode, currentPage, goToPage])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: theme.bg }}>
      {/* Top controls */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20,
        paddingTop: 'var(--safe-top)', background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none',
        transition: 'opacity 0.3s', height: 'auto', minHeight: 'calc(var(--safe-top) + 48px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', width: '100%', justifyContent: 'space-between' }}>
          <button style={{ background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: 20, padding: '8px 16px', color: '#1a1a2e', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={handleClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            返回
          </button>
          <button style={{ background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: 20, padding: '8px 16px', color: '#1a1a2e', fontSize: 14, fontWeight: 700, cursor: 'pointer' }} onClick={() => { setShowSettings(true); setShowControls(false) }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </button>
        </div>
      </div>

      {/* Content area */}
      <div
        ref={contentRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          filter: settings.brightness < 100 ? `brightness(${settings.brightness / 100})` : undefined,
          position: 'relative',
          touchAction: isSwipeMode ? 'none' : 'auto'
        }}
        onClick={toggleControls}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Inner container: translateY for page positioning, translateX for swipe visual */}
        <div style={{
          padding: 'calc(var(--safe-top, 24px) + 56px) 20px calc(var(--safe-bottom, 34px) + 108px)',
          transform: `translate(${isSwipeMode ? swipeOffset : 0}px, ${isSwipeMode ? -(pageOffsets[currentPage] || 0) : 0}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease',
          fontSize: settings.fontSize,
          lineHeight: settings.lineHeight,
          fontFamily: fontFamilyMap[settings.fontFamily] || fontFamilyMap.system,
          color: theme.text,
          maxWidth: settings.maxWidth > 0 ? settings.maxWidth : undefined,
          margin: isSwipeMode ? undefined : '0 auto',
          textAlign: 'justify',
          wordBreak: 'break-word',
          userSelect: 'text',
          WebkitUserSelect: 'text'
        }}>
          {loading && paragraphs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
              <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>加载中...</p>
            </div>
          )}

          {!loading && paragraphs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>暂无内容</div>
          )}

          {paragraphs.map((p, i) => (
            <p
              key={i}
              data-page-para={isSwipeMode ? '1' : undefined}
              style={{ marginBottom: `${settings.paragraphSpacing}em`, textIndent: '2em' }}
            >
              {p}
            </p>
          ))}

          {!isSwipeMode && paragraphs.length > 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {currentChapterIdx + 1} / {book.chapters.length}
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
        background: 'var(--accent)', padding: '12px 16px calc(var(--safe-bottom) + 12px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none',
        transition: 'opacity 0.3s'
      }}>
        <button style={{ background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: 20, padding: '8px 20px', color: '#1a1a2e', fontSize: 14, fontWeight: 700, cursor: hasPrev ? 'pointer' : 'default', opacity: hasPrev ? 1 : 0.4, flex: 1 }} onClick={handlePrevChapter} disabled={!hasPrev}>上一章</button>
        <div style={{ flex: 2, textAlign: 'center', color: '#1a1a2e', fontSize: 12, fontWeight: 700 }}>
          {isSwipeMode ? `${currentPage + 1}/${pageCount} · 第${currentChapterIdx + 1}章` : `${currentChapterIdx + 1} / ${book.chapters.length}`}
        </div>
        <button style={{ background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: 20, padding: '8px 20px', color: '#1a1a2e', fontSize: 14, fontWeight: 700, cursor: hasNext ? 'pointer' : 'default', opacity: hasNext ? 1 : 0.4, flex: 1 }} onClick={handleNextChapter} disabled={!hasNext}>下一章</button>
      </div>

      {/* Chapter indicator */}
      <div style={{ position: 'fixed', top: 'calc(var(--safe-top) + 60px)', right: 6, zIndex: 15, display: 'flex', flexDirection: 'column', gap: 4, opacity: showControls ? 0 : 0.6, transition: 'opacity 0.3s' }}>
        {book.chapters.map((_, i) => (
          <div key={i} style={{ width: 3, height: book.chapters.length > 20 ? 6 : 16, borderRadius: 2, background: i === currentChapterIdx ? 'var(--accent)' : (settings.theme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'), transition: 'all 0.2s' }} />
        ))}
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)' }}>
            <div className="modal-handle" />
            <h3 style={{ fontSize: 16, marginBottom: 16, color: 'var(--accent)' }}>阅读设置</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>翻页模式</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ key: 'swipe' as const, label: '左右翻页' }, { key: 'scroll' as const, label: '上下滚动' }].map(m => (
                  <button key={m.key} onClick={() => { changeSetting('pageMode', m.key); setCurrentPage(0) }} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: settings.pageMode === m.key ? '2px solid var(--accent)' : '2px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', fontWeight: settings.pageMode === m.key ? 700 : 400, transition: 'all 0.2s' }}>{m.label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>字体大小：{settings.fontSize}px</label>
              <input type="range" min="14" max="28" value={settings.fontSize} onChange={e => changeSetting('fontSize', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>行间距：{settings.lineHeight.toFixed(1)}</label>
              <input type="range" min="1.3" max="2.5" step="0.1" value={settings.lineHeight} onChange={e => changeSetting('lineHeight', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>主题</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['dark', 'light', 'sepia'] as const).map(t => (
                  <button key={t} onClick={() => changeSetting('theme', t)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: settings.theme === t ? '2px solid var(--accent)' : '2px solid var(--border)', background: t === 'dark' ? '#1a1a2e' : t === 'light' ? '#f5f5f0' : '#f4ecd8', color: t === 'dark' ? '#ddd' : t === 'light' ? '#333' : '#5a4738', fontSize: 12, cursor: 'pointer', fontWeight: settings.theme === t ? 700 : 400, transition: 'all 0.2s' }}>{t === 'dark' ? '暗黑' : t === 'light' ? '明亮' : '护眼'}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>字体</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ key: 'system', label: '系统' }, { key: 'serif', label: '衬线' }, { key: 'mono', label: '等宽' }].map(f => (
                  <button key={f.key} onClick={() => changeSetting('fontFamily', f.key)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: settings.fontFamily === f.key ? '2px solid var(--accent)' : '2px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', fontWeight: settings.fontFamily === f.key ? 700 : 400, transition: 'all 0.2s' }}>{f.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
