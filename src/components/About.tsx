import { useState, useCallback } from 'react'
import { checkForUpdates, downloadAndApply, getUpdateUrl } from '../utils/updater'

const changelog = [
  { version: '1.4.2', date: '2026-06-14', changes: [
    '阅读器顶栏底栏改为黄色高亮突出', '顶栏底栏全面屏safe-area适配', '章节指示条优化'
  ]},
  { version: '1.4.1', date: '2026-06-14', changes: [
    'OTA更新源增加jsDelivr CDN镜像回退', '自动检查更新失败时显示错误提示', 'HTML资源解析适配相对路径(./assets/)'
  ]},
  { version: '1.4.0', date: '2026-06-14', changes: [
    '全局全面屏安全区自适应（JS兜底检测+CSS变量统一）', 'header/tab-bar/modal/toast 全面适配安全区', '书籍详情页：章节目录/作者/操作按钮完成', '预缓存书索引增至18本'
  ]},
  { version: '1.3.0', date: '2026-06-14', changes: [
    '发现页点击进入书籍详情页（显示章节目录/作者/来源等信息）', '详情页可加入书架后再开始阅读', '阅读器全面屏安全区适配修复（顶部按钮不再被状态栏遮挡）', '预缓存书籍增至12本'
  ]},
  { version: '1.2.0', date: '2026-06-13', changes: [
    '发现页改为本地加载预缓存书籍', '预置7本小说本地缓存（JSON格式含全文）', '支持OTA远程获取新增书籍到发现页', '搜索页增加本地书籍索引搜索'
  ]},
  { version: '1.1.0', date: '2026-06-13', changes: [
    '新增发现页：热门分类推荐、书籍卡片浏览', '暗黑/白天模式切换', '全面屏沉浸式适配', '搜索性能大幅优化（8s超时、并发提速）', '启动自动检查OTA更新并弹窗提醒', '书源增加到21个（含集书阁）'
  ]},
  { version: '1.0.0', date: '2026-06-13', changes: [
    '首个正式版发布', '内置20+中文小说书源', '多源搜索与换源', '书架管理与本地缓存', '沉浸式阅读器（主题/字体调节）', 'OTA热更新支持', '迭代日志'
  ]},
  { version: '0.3.0', date: '2026-06-10', changes: ['重构书源架构', '支持多源并行搜索', '阅读器性能优化', 'UI动效改进']},
  { version: '0.2.0', date: '2026-06-05', changes: ['阅读器核心功能', '字体/主题切换', '章节缓存', '阅读进度保存']},
  { version: '0.1.0', date: '2026-06-01', changes: ['项目初始化', 'React + TypeScript + Vite', '书架页面', 'Gutendex API搜索', 'IndexedDB存储']}
]

interface Props {
  currentVersion: string
  showToast: (msg: string) => void
  onClose: () => void
}

export default function About({ currentVersion, showToast, onClose }: Props) {
  const [checking, setChecking] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null)
  const [remoteDesc, setRemoteDesc] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [expandedVer, setExpandedVer] = useState<string | null>('1.4.2')

  const checkUpdate = useCallback(async () => {
    setChecking(true)
    setErrorMsg('')
    setRemoteVersion(null)
    const result = await checkForUpdates(getUpdateUrl())
    setChecking(false)
    if (result.error) { setErrorMsg(result.error); return }
    if (result.hasUpdate) {
      setRemoteVersion(result.version || null)
      setRemoteDesc(result.description || '')
    } else {
      showToast('已是最新版本 ✓')
    }
  }, [showToast])

  const startDownload = useCallback(async () => {
    setDownloading(true)
    const result = await downloadAndApply(getUpdateUrl())
    if (result.success) {
      showToast('更新已就绪，即将重启...')
      setTimeout(() => window.location.reload(), 2000)
    } else {
      setErrorMsg(result.error || '下载失败')
    }
    setDownloading(false)
  }, [showToast])

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
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>关于 Yellow</h1>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px calc(var(--safe-bottom) + 16px)' }}>
        {/* 版本信息 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>Yellow</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>简洁强大的移动端阅读器</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>当前版本 v{currentVersion} · React + Capacitor</div>
        </div>

        {/* 版本更新 */}
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>版本更新</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>当前 v{currentVersion}</div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={checkUpdate}
              disabled={checking || downloading}
            >
              {checking ? '检查中...' : '检查更新'}
            </button>
          </div>

          {remoteVersion && (
            <div className="scale-in" style={{
              background: 'var(--accent-glow)', border: '1px solid rgba(240,192,64,0.3)',
              borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginTop: 12
            }}>
              <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 14 }}>
                ↑ 发现新版本 v{remoteVersion}
              </div>
              {remoteDesc && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{remoteDesc}</div>}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>v{currentVersion} → v{remoteVersion}</div>
              <button
                className="btn btn-primary btn-sm" style={{ marginTop: 10, width: '100%' }}
                onClick={startDownload} disabled={downloading}
              >
                {downloading ? '下载中...' : '立即更新'}
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="fade-in" style={{
              background: 'rgba(224,85,85,0.1)', border: '1px solid rgba(224,85,85,0.3)',
              borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginTop: 10,
              fontSize: 12, color: 'var(--danger)'
            }}>{errorMsg}</div>
          )}
        </div>

        {/* 书源统计 */}
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>内置书源</span>
            <span style={{ fontWeight: 600 }}>20 个</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            笔趣阁系列 · 趣笔阁 · 顶点小说 · 妙笔阁 等
          </div>
        </div>

        {/* 迭代日志 */}
        <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>迭代日志</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {changelog.map((v, i) => (
            <div key={v.version} className="card fade-in" style={{ padding: 0, animationDelay: `${i * 0.05}s`, border: v.version === '1.0.0' ? '1px solid var(--accent)' : undefined }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', cursor: 'pointer' }}
                onClick={() => setExpandedVer(expandedVer === v.version ? null : v.version)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 4, background: v.version === '1.0.0' ? 'var(--accent)' : 'var(--text-muted)' }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>v{v.version}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.date}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: expandedVer === v.version ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-muted)' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              <div style={{
                overflow: 'hidden', maxHeight: expandedVer === v.version ? 300 : 0,
                opacity: expandedVer === v.version ? 1 : 0,
                transition: 'max-height 0.3s ease, opacity 0.2s ease'
              }}>
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {v.changes.map((c, ci) => (
                    <div key={ci} style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--accent)' }}>+</span> {c}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
