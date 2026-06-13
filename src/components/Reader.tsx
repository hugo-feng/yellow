import { useState, useEffect, useCallback, useRef } from 'react'
import type { Book, Chapter, ReaderSettings, ReadingProgress } from '../types'
import { saveChapter, getChapter } from '../utils/db'
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
  const [chapterIdx, setChapterIdx] = useState(initialProgress?.chapterIndex ?? 0)
  const [showControls, setShowControls] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const chapter = book.chapters[chapterIdx]
  const hasPrev = chapterIdx > 0
  const hasNext = chapterIdx < book.chapters.length - 1
  const isSwipe = settings.pageMode === 'swipe'

  const themeMap = {
    dark: { bg: '#0f0f1a', text: '#d8d8e0' },
    light: { bg: '#f5f5f0', text: '#1a1a1a' },
    sepia: { bg: '#f4ecd8', text: '#4a3728' }
  } as const
  const theme = themeMap[settings.theme]

  const fontMap: Record<string, string> = {
    system: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
    serif: 'Georgia, "Times New Roman", "Songti SC", serif',
    mono: '"SF Mono", "Fira Code", "Courier New", monospace'
  }

  const paragraphs = content ? content.replace(/\r\n/g, '\n').split('\n').filter(p => p.trim()) : []

  const loadContent = useCallback(async () => {
    if (!chapter) return
    setLoading(true)
    let c = chapter.content
    if (!c) {
      const cached = await getChapter(`${book.id}-ch-${chapter.index}`)
      if (cached?.content) { c = cached.content }
    }
    if (!c) {
      try {
        const full = await getBookContent(book.id, book.sourceId)
        if (full.chapters.length > 0) {
          book.chapters = full.chapters
          c = full.chapters[0].content || ''
          if (c) await saveChapter({ ...full.chapters[0], id: `${book.id}-ch-0` })
        }
      } catch { c = '加载失败，请检查网络后重试。' }
    }
    if (c) chapter.content = c
    setContent(c || '')
    setLoading(false)
  }, [chapterIdx, book.id, book.sourceId])

  useEffect(() => { loadContent() }, [chapterIdx])

  const toggleControls = useCallback(() => {
    setShowControls(p => !p)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!showControls) timerRef.current = setTimeout(() => setShowControls(false), 4000)
  }, [showControls])

  const goChapter = useCallback((dir: number) => {
    const next = chapterIdx + dir
    if (next >= 0 && next < book.chapters.length) {
      setChapterIdx(next)
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    }
  }, [chapterIdx, book.chapters.length])

  const handleClose = useCallback(() => {
    onClose({
      bookId: book.id,
      chapterIndex: chapterIdx,
      scrollPosition: scrollRef.current?.scrollTop ?? 0,
      updatedAt: Date.now()
    })
  }, [book.id, chapterIdx, onClose])

  const changeSetting = useCallback(<K extends keyof ReaderSettings>(k: K, v: ReaderSettings[K]) => {
    onSettingsChange({ ...settings, [k]: v })
  }, [settings, onSettingsChange])

  // ── Swipe mode state ──
  const [page, setPage] = useState(0)
  const [offset, setOffset] = useState(0)
  const [paging, setPaging] = useState(false)
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const [pages, setPages] = useState<string[][]>([])

  // Measure and split into pages
  useEffect(() => {
    if (!isSwipe || paragraphs.length === 0) { setPages([]); return }
    const el = scrollRef.current
    if (!el || el.clientHeight <= 0) return

    const containerH = el.clientHeight
    const fontSize = settings.fontSize
    const lh = settings.lineHeight
    const spacing = settings.paragraphSpacing
    const charW = fontSize * 0.55
    const contentW = Math.min(el.clientWidth - 40, settings.maxWidth || 9999)
    const cpl = Math.floor(contentW / charW) || 20

    const result: string[][] = []
    let cur: string[] = []
    let usedH = 0

    for (const p of paragraphs) {
      const indent = fontSize * 2
      const firstCpl = Math.floor((contentW - indent) / charW) || cpl
      const extra = p.length > firstCpl ? Math.ceil((p.length - firstCpl) / cpl) : 0
      const lines = 1 + extra
      const pH = lines * fontSize * lh + fontSize * spacing

      if (usedH + pH > containerH && cur.length > 0) {
        result.push(cur)
        cur = []
        usedH = 0
      }
      cur.push(p)
      usedH += pH
    }
    if (cur.length > 0) result.push(cur)
    setPages(result.length > 0 ? result : [paragraphs])
    setPage(0)
  }, [isSwipe, content, settings.fontSize, settings.lineHeight, settings.paragraphSpacing, settings.maxWidth])

  useEffect(() => {
    if (page >= pages.length) setPage(Math.max(0, pages.length - 1))
  }, [pages])

  const swipeToPage = useCallback((p: number) => {
    if (p < 0) {
      if (hasPrev) { goChapter(-1); setTimeout(() => setPage(9999), 50) }
    } else if (p >= pages.length) {
      if (hasNext) { goChapter(1); setTimeout(() => setPage(0), 50) }
    } else {
      setPage(p)
    }
  }, [pages.length, hasNext, hasPrev, goChapter])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isSwipe) return
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() }
    setPaging(true)
  }, [isSwipe])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current || !isSwipe) return
    const t = e.touches[0]
    const dx = t.clientX - touchRef.current.x
    const dy = t.clientY - touchRef.current.y
    if (Math.abs(dx) > Math.abs(dy)) setOffset(dx)
  }, [isSwipe])

  const onTouchEnd = useCallback(() => {
    if (!touchRef.current || !isSwipe) return
    const elapsed = Date.now() - touchRef.current.t
    const vel = Math.abs(offset) / (elapsed || 1) * 1000
    if (offset < -60 || (offset < -20 && vel > 200)) swipeToPage(page + 1)
    else if (offset > 60 || (offset > 20 && vel > 200)) swipeToPage(page - 1)
    setPaging(false)
    setOffset(0)
    touchRef.current = null
  }, [offset, isSwipe, page, swipeToPage])

  // ── Render ──
  const contentPadding = 'calc(var(--safe-top, 24px) + 56px) 20px calc(var(--safe-bottom, 34px) + 108px)'
  const textStyle = {
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    fontFamily: fontMap[settings.fontFamily] || fontMap.system,
    color: theme.text,
    maxWidth: settings.maxWidth > 0 ? settings.maxWidth : undefined,
    margin: '0 auto',
    textAlign: 'justify' as const,
    wordBreak: 'break-word' as const,
    userSelect: 'text' as const,
    WebkitUserSelect: 'text' as const
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: theme.bg }}>
      {/* Top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20,
        paddingTop: 'var(--safe-top)', background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none',
        transition: 'opacity 0.3s', minHeight: 'calc(var(--safe-top) + 48px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', width: '100%', justifyContent: 'space-between' }}>
          <button style={{ background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: 20, padding: '8px 16px', color: '#1a1a2e', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={handleClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>返回
          </button>
          <button style={{ background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: 20, padding: '8px 16px', color: '#1a1a2e', fontSize: 14, fontWeight: 700, cursor: 'pointer' }} onClick={() => { setShowSettings(true); setShowControls(false) }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {isSwipe ? (
        <div
          ref={scrollRef}
          style={{ flex: 1, overflow: 'hidden', position: 'relative', touchAction: 'none', filter: settings.brightness < 100 ? `brightness(${settings.brightness / 100})` : undefined }}
          onClick={toggleControls}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div style={{
            padding: contentPadding,
            transform: `translateX(${offset}px)`,
            transition: paging ? 'none' : 'transform 0.3s ease',
            ...textStyle
          }}>
            {loading && <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /><p style={{ marginTop: 12, color: 'var(--text-muted)' }}>加载中...</p></div>}
            {!loading && paragraphs.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>暂无内容</div>}
            {(pages[page] || []).map((p, i) => (
              <p key={`p${page}-${i}`} style={{ marginBottom: `${settings.paragraphSpacing}em`, textIndent: '2em' }}>{p}</p>
            ))}
          </div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          style={{ flex: 1, overflow: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', padding: contentPadding, filter: settings.brightness < 100 ? `brightness(${settings.brightness / 100})` : undefined }}
          onClick={toggleControls}
        >
          <div style={textStyle}>
            {loading && <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /><p style={{ marginTop: 12, color: 'var(--text-muted)' }}>加载中...</p></div>}
            {!loading && paragraphs.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>暂无内容</div>}
            {paragraphs.map((p, i) => (
              <p key={i} style={{ marginBottom: `${settings.paragraphSpacing}em`, textIndent: '2em' }}>{p}</p>
            ))}
            {paragraphs.length > 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                {chapterIdx + 1} / {book.chapters.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
        background: 'var(--accent)', padding: '12px 16px calc(var(--safe-bottom) + 12px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none', transition: 'opacity 0.3s'
      }}>
        <button style={{ background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: 20, padding: '8px 20px', color: '#1a1a2e', fontSize: 14, fontWeight: 700, cursor: hasPrev ? 'pointer' : 'default', opacity: hasPrev ? 1 : 0.4, flex: 1 }} onClick={() => goChapter(-1)} disabled={!hasPrev}>上一章</button>
        <div style={{ flex: 2, textAlign: 'center', color: '#1a1a2e', fontSize: 12, fontWeight: 700 }}>
          {isSwipe ? `${page + 1}/${pages.length} · 第${chapterIdx + 1}章` : `${chapterIdx + 1} / ${book.chapters.length}`}
        </div>
        <button style={{ background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: 20, padding: '8px 20px', color: '#1a1a2e', fontSize: 14, fontWeight: 700, cursor: hasNext ? 'pointer' : 'default', opacity: hasNext ? 1 : 0.4, flex: 1 }} onClick={() => goChapter(1)} disabled={!hasNext}>下一章</button>
      </div>

      {/* Chapter dots */}
      <div style={{ position: 'fixed', top: 'calc(var(--safe-top) + 60px)', right: 6, zIndex: 15, display: 'flex', flexDirection: 'column', gap: 4, opacity: showControls ? 0 : 0.6, transition: 'opacity 0.3s' }}>
        {book.chapters.map((_, i) => (
          <div key={i} style={{ width: 3, height: book.chapters.length > 20 ? 6 : 16, borderRadius: 2, background: i === chapterIdx ? 'var(--accent)' : (settings.theme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'), transition: 'all 0.2s' }} />
        ))}
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)' }}>
            <div className="modal-handle" />
            <h3 style={{ fontSize: 16, marginBottom: 16, color: 'var(--accent)' }}>阅读设置</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>翻页模式</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ key: 'swipe' as const, label: '左右翻页' }, { key: 'scroll' as const, label: '上下滚动' }].map(m => (
                  <button key={m.key} onClick={() => { changeSetting('pageMode', m.key); setPage(0) }} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: settings.pageMode === m.key ? '2px solid var(--accent)' : '2px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', fontWeight: settings.pageMode === m.key ? 700 : 400, transition: 'all 0.2s' }}>{m.label}</button>
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
