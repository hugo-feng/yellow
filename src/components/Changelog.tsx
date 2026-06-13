import { useState } from 'react'

interface Version {
  version: string
  date: string
  changes: string[]
}

const changelog: Version[] = [
  {
    version: '1.0.0',
    date: '2026-06-13',
    changes: [
      '首个正式版本发布',
      '支持多书源搜索（Project Gutenberg、Open Library）',
      '书架管理：添加、删除、缓存书籍',
      '沉浸式阅读器：支持主题切换、字体调节',
      '阅读进度自动保存与恢复',
      '侧边栏快速章节导航',
      '数据缓存在本地 IndexedDB',
      '底部标签栏快速切换页面',
      '页面过渡动画效果',
      '迭代日志查看版本更新'
    ]
  },
  {
    version: '0.3.0-beta',
    date: '2026-06-10',
    changes: [
      '重构书源架构，支持多源搜索',
      '优化阅读器性能，大段落渲染更流畅',
      '添加书籍缓存清理功能',
      'UI 动效优化，页面切换更顺滑'
    ]
  },
  {
    version: '0.2.0-alpha',
    date: '2026-06-05',
    changes: [
      '添加阅读器组件，支持基本阅读功能',
      '支持字体大小和主题切换',
      '章节内容本地缓存',
      '阅读进度追踪'
    ]
  },
  {
    version: '0.1.0-alpha',
    date: '2026-06-01',
    changes: [
      '项目初始化',
      '基础架构搭建：React + TypeScript + Vite',
      '新增书架页面布局',
      '新增搜索页面（Gutendex API 集成）',
      'IndexedDB 数据持久化方案'
    ]
  }
]

export default function Changelog() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['1.0.0']))

  const toggle = (version: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(version)) next.delete(version)
      else next.add(version)
      return next
    })
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>Yellow Reader</h2>
          <span className="badge" style={{ fontSize: 12 }}>v1.0.0</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          简洁强大的移动端阅读器 · 支持多书源 · 本地缓存
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>当前版本</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>1.0.0</div>
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 12 }}>
        迭代历史
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
          共 {changelog.length} 个版本
        </span>
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {changelog.map((v, idx) => {
          const isExpanded = expanded.has(v.version)
          return (
            <div
              key={v.version}
              className="card fade-in"
              style={{
                padding: 0,
                animationDelay: `${idx * 0.08}s`,
                border: v.version === '1.0.0' ? '1px solid var(--accent)' : undefined
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  cursor: 'pointer'
                }}
                onClick={() => toggle(v.version)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: v.version === '1.0.0' ? 'var(--accent)' : 'var(--text-muted)'
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>v{v.version}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.date}</div>
                  </div>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s',
                    color: 'var(--text-muted)'
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              <div
                style={{
                  overflow: 'hidden',
                  maxHeight: isExpanded ? 300 : 0,
                  opacity: isExpanded ? 1 : 0,
                  transition: 'max-height 0.4s ease, opacity 0.3s ease, padding 0.3s ease',
                  padding: isExpanded ? '0 16px 14px' : '0 16px'
                }}
              >
                <div
                  style={{
                    borderTop: '1px solid var(--border)',
                    paddingTop: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  {v.changes.map((change, ci) => (
                    <div
                      key={ci}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}
                    >
                      <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>+</span>
                      <span>{change}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
