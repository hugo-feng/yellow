import { useState, useEffect } from 'react'
import type { Book, ReaderSettings } from '../types'
import { getStorageInfo } from '../utils/db'
import { useTheme } from '../hooks/useTheme'

interface Props {
  books: Book[]
  showToast: (msg: string) => void
  onOpenAbout: () => void
  cacheTask?: { bookId: string; title: string; progress: number; current: number; total: number } | null
  onOpenCacheManager?: () => void
  readerSettings?: ReaderSettings
  onReaderSettingsChange?: (settings: ReaderSettings) => void
}

export default function Settings({ books, showToast, onOpenAbout, cacheTask, onOpenCacheManager, readerSettings, onReaderSettingsChange }: Props) {
  const { theme, toggle: toggleTheme } = useTheme()

  const updateReader = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    if (readerSettings && onReaderSettingsChange) {
      onReaderSettingsChange({ ...readerSettings, [key]: value })
    }
  }

  return (
    <div style={{ padding: 16 }}>
      {/* 外观 */}
      <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>外观</h3>
      <div className="card" style={{ padding: '14px 16px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>暗黑模式</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{theme === 'dark' ? '已开启' : '已关闭'}</div>
          </div>
          <button className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={toggleTheme} />
        </div>
      </div>

      {/* 阅读设置 */}
      <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>阅读设置</h3>
      <div className="card" style={{ padding: '14px 16px', marginBottom: 24 }}>
        {readerSettings && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>字体大小</span><span style={{ fontWeight: 600 }}>{readerSettings.fontSize}px</span>
              </label>
              <input type="range" min="14" max="28" value={readerSettings.fontSize}
                onChange={e => updateReader('fontSize', Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>行间距</span><span style={{ fontWeight: 600 }}>{readerSettings.lineHeight.toFixed(1)}</span>
              </label>
              <input type="range" min="1.3" max="2.5" step="0.1" value={readerSettings.lineHeight}
                onChange={e => updateReader('lineHeight', Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>段间距</span><span style={{ fontWeight: 600 }}>{readerSettings.paragraphSpacing.toFixed(1)}em</span>
              </label>
              <input type="range" min="0.4" max="2.0" step="0.1" value={readerSettings.paragraphSpacing}
                onChange={e => updateReader('paragraphSpacing', Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>亮度</span><span style={{ fontWeight: 600 }}>{readerSettings.brightness}%</span>
              </label>
              <input type="range" min="30" max="100" value={readerSettings.brightness}
                onChange={e => updateReader('brightness', Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>阅读主题</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['dark', 'light', 'sepia'] as const).map(t => (
                  <button key={t} onClick={() => updateReader('theme', t)} style={{
                    flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)',
                    border: readerSettings.theme === t ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: t === 'dark' ? '#1a1a2e' : t === 'light' ? '#f5f5f0' : '#f4ecd8',
                    color: t === 'dark' ? '#ddd' : t === 'light' ? '#333' : '#5a4738',
                    fontSize: 12, cursor: 'pointer', fontWeight: readerSettings.theme === t ? 700 : 400, transition: 'all 0.2s'
                  }}>
                    {t === 'dark' ? '暗黑' : t === 'light' ? '明亮' : '护眼'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>字体</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ key: 'system', label: '系统' }, { key: 'serif', label: '衬线' }, { key: 'mono', label: '等宽' }].map(f => (
                  <button key={f.key} onClick={() => updateReader('fontFamily', f.key)} style={{
                    flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)',
                    border: readerSettings.fontFamily === f.key ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    fontSize: 12, cursor: 'pointer', fontWeight: readerSettings.fontFamily === f.key ? 700 : 400, transition: 'all 0.2s'
                  }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>内容宽度</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ key: 600, label: '窄' }, { key: 720, label: '标准' }, { key: 900, label: '宽' }, { key: 0, label: '全屏' }].map(w => (
                  <button key={w.key} onClick={() => updateReader('maxWidth', w.key)} style={{
                    flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)',
                    border: readerSettings.maxWidth === w.key ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    fontSize: 12, cursor: 'pointer', fontWeight: readerSettings.maxWidth === w.key ? 700 : 400, transition: 'all 0.2s'
                  }}>
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 其他 */}
      <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>其他</h3>

      {/* 缓存管理 */}
      {onOpenCacheManager && (
        <button className="card" style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px', marginBottom: 12, cursor: 'pointer', background: 'var(--bg-card)',
          border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14
        }} onClick={onOpenCacheManager}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(76,175,132,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600 }}>缓存管理</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {cacheTask ? `正在缓存: ${cacheTask.title} ${cacheTask.progress}%` : '管理已缓存书籍和存储空间'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {cacheTask && <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><polyline points="9 18 15 12 9 6" /></svg>
          </div>
        </button>
      )}

      {cacheTask && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>正在缓存: {cacheTask.title}</span>
            <span>{cacheTask.current}/{cacheTask.total}章</span>
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${cacheTask.progress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* 关于 */}
      <button className="card" style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px', marginBottom: 12, cursor: 'pointer', background: 'var(--bg-card)',
        border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14
      }} onClick={onOpenAbout}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600 }}>关于 Yellow</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>版本更新 · 迭代日志 · 书源信息</div>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><polyline points="9 18 15 12 9 6" /></svg>
      </button>
    </div>
  )
}
