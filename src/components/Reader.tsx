import { useState, useEffect, useCallback, useRef } from 'react'
import DOMPurify from 'dompurify'
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
      if (cached?.content) c = cached.content
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
    setContent(c ? DOMPurify.sanitize(c, { ALLOWED_TAGS: [] }) : '')
    setLoading(false)
  }, [chapterIdx, book.id, book.sourceId])

  useEffect(() => { loadContent() }, [chapterIdx])

  useEffect(() => {
    if (!loading && content && scrollRef.current) {
      const savedPos = initialProgress?.chapterIndex === chapterIdx ? (initialProgress?.scrollPosition ?? 0) : 0
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = savedPos
      })
    }
  }, [loading, content, chapterIdx])

  const chapterWeights = book.chapters.map(ch => (ch.content?.length || 1000))
  const totalWeight = chapterWeights.reduce((a, b) => a + b, 0)

  const [scrollProgress, setScrollProgress] = useState(0)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    setScrollProgress(max > 0 ? el.scrollTop / max : 0)
  }, [])

  const toggleControls = useCallback(() => {
    setShowControls(p => !p)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!showControls) timerRef.current = setTimeout(() => setShowControls(false), 4000)
  }, [showControls])

  const goChapter = useCallback((dir: number) => {
    const next = chapterIdx + dir
    if (next >= 0 && next < book.chapters.length) {
      setChapterIdx(next)
      setScrollProgress(0)
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

  const completedWeight = chapterWeights.slice(0, chapterIdx).reduce((a, b) => a + b, 0)
  const currentWeight = chapterWeights[chapterIdx] || 1000
  const overallPercent = totalWeight > 0
    ? Math.round((completedWeight + currentWeight * scrollProgress) / totalWeight * 100)
    : 0

  const safeTop = 'var(--safe-top, 24px)'
  const safeBottom = '0px'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: theme.bg, position: 'relative' }}>
      {/* Top safe area background */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 21,
        height: safeTop, background: showControls ? 'rgba(0,0,0,1)' : theme.bg,
        transition: 'background 0.25s'
      }} />

      {/* Bottom safe area background */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 21,
        height: safeBottom, background: showControls ? 'rgba(0,0,0,1)' : theme.bg,
        transition: 'background 0.25s'
      }} />

      {/* Top bar */}
      <div style={{
        position: 'fixed', top: safeTop, left: 0, right: 0, zIndex: 20,
        height: 48,
        background: 'rgba(0,0,0,1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none',
        transition: 'opacity 0.25s'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', width: '100%', justifyContent: 'space-between' }}>
          <button style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20, padding: '8px 16px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={handleClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            返回
          </button>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{overallPercent}%</span>
          <button style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20, padding: '8px 16px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }} onClick={() => { setShowSettings(true); setShowControls(false) }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflow: 'auto', overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          paddingTop: `calc(${safeTop} + 48px)`,
          paddingBottom: `calc(${safeBottom} + 60px)`,
          paddingLeft: 16,
          paddingRight: 16,
          filter: settings.brightness < 100 ? `brightness(${settings.brightness / 100})` : undefined
        }}
        onClick={toggleControls}
        onScroll={handleScroll}
      >
        <div style={{
          fontSize: settings.fontSize,
          lineHeight: settings.lineHeight,
          fontFamily: fontMap[settings.fontFamily] || fontMap.system,
          color: theme.text,
          maxWidth: settings.maxWidth > 0 ? settings.maxWidth : undefined,
          margin: '0 auto',
          textAlign: 'left',
          wordBreak: 'break-word',
          userSelect: 'text',
          WebkitUserSelect: 'text'
        }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
              <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>加载中...</p>
            </div>
          )}
          {!loading && paragraphs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>暂无内容</div>
          )}
          {paragraphs.map((p, i) => (
            <p key={i} style={{ marginBottom: `${settings.paragraphSpacing}em`, textIndent: '2em' }}>{p}</p>
          ))}
          {paragraphs.length > 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '40px 0 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              —— {overallPercent}% · 第{chapterIdx + 1}/{book.chapters.length}章 ——
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'fixed', bottom: safeBottom, left: 0, right: 0, zIndex: 20,
        height: 'auto',
        background: 'rgba(0,0,0,1)',
        opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none',
        transition: 'opacity 0.25s'
      }}>
        {/* Progress slider */}
        <div style={{ padding: '8px 16px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', minWidth: 32, textAlign: 'right' }}>{chapterIdx + 1}</span>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', position: 'relative', cursor: 'pointer' }}
              onClick={(e) => {
                const el = scrollRef.current
                if (!el) return
                const rect = e.currentTarget.getBoundingClientRect()
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
              }}
            >
              <div style={{ height: '100%', width: `${scrollProgress * 100}%`, borderRadius: 2, background: 'var(--accent)', transition: 'width 0.1s' }} />
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', minWidth: 32 }}>{book.chapters.length}</span>
          </div>
        </div>

        {/* Chapter nav buttons */}
        <div style={{ display: 'flex', padding: '4px 16px 12px', gap: 10 }}>
          <button style={{
            flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
            padding: '10px', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: hasPrev ? 'pointer' : 'default', opacity: hasPrev ? 1 : 0.3
          }} onClick={() => goChapter(-1)} disabled={!hasPrev}>上一章</button>
          <button style={{
            flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
            padding: '10px', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: hasNext ? 'pointer' : 'default', opacity: hasNext ? 1 : 0.3
          }} onClick={() => goChapter(1)} disabled={!hasNext}>下一章</button>
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)' }}>
            <div className="modal-handle" />
            <h3 style={{ fontSize: 16, marginBottom: 16, color: 'var(--accent)' }}>阅读设置</h3>
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
