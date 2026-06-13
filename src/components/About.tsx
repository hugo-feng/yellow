import { useState, useCallback } from 'react'
import { checkForUpdates, getApkUrl, APP_VERSION } from '../utils/updater'
import AppUpdater from '../plugins/AppUpdater'

const changelog = [
  { version: '2.0.2', date: '2026-06-14', changes: [
    '修复下载进度不动：移除不可靠的镜像HEAD测速，直接用GitHub原链',
    'DownloadManager原生支持HTTP重定向，自动走GitHub CDN',
    '修复Java插件call.resolve重复调用bug，进度轮询改为500ms'
  ]},
  { version: '2.0.1', date: '2026-06-14', changes: [
    '阅读进度：基于章节权重+滚动/翻页位置计算全书百分比',
    '翻页分页：用隐藏测量div获取真实段落高度，不再依赖字符估算',
    '顶栏+底栏+内容区底部均显示进度百分比',
    '底部常驻进度条'
  ]},
  { version: '2.0.0', date: '2026-06-14', changes: [
    '更新机制重写：后台自动下载APK+下载完成后自动拉起安装',
    '国内镜像加速：ghfast.top/ghproxy.cn/mirror.ghproxy.com 优先',
    '原生Capacitor插件：Android DownloadManager下载+FileProvider安装'
  ]},
  { version: '1.9.9', date: '2026-06-14', changes: [
    '更新机制改为跳转GitHub Release下载APK（OTA热更新在SW架构下不可靠）',
    '修复更新描述乱码：GitHub API base64中文UTF-8解码',
    '修复重启后重复弹更新：启动时清除update-pending标记'
  ]},
  { version: '1.9.8', date: '2026-06-14', changes: [
    '修复翻页分页：中文字符宽度从0.55修正为0.95，扣除padding计算可用高度'
  ]},
  { version: '1.9.7', date: '2026-06-14', changes: [
    'OTA终极修复：用GitHub API获取版本（绕过jsDelivr和raw.githubusercontent.com的CDN缓存）'
  ]},
  { version: '1.9.6', date: '2026-06-14', changes: [
    'OTA修复：GitHub raw设为首选更新源（jsDelivr CDN缓存过期不刷新）'
  ]},
  { version: '1.9.5', date: '2026-06-14', changes: [
    'Reader彻底重写：翻页模式和滚动模式完全分离，不再共用容器',
    '翻页模式：overflow:hidden + translateX滑动 + 字符估算分页',
    '滚动模式：overflow:auto 正常上下滚动',
    '切换模式时容器属性完全切换，不再互相干扰'
  ]},
  { version: '1.9.4', date: '2026-06-14', changes: [
    'OTA根治：版本化SW缓存（activate清除旧缓存）+ 纯XHR检查 + 启动清理',
    '安装新版本后自动清除旧缓存，保留用户设置',
    '版本号直接编译进JS bundle，不再读version.json'
  ]},
  { version: '1.9.3', date: '2026-06-14', changes: [
    'OTA调试版：About页直接用XHR测试CDN可达性，显示调试日志'
  ]},
  { version: '1.9.2', date: '2026-06-14', changes: [
    'OTA验证版本：确认app内检查更新可正常检测到新版本'
  ]},
  { version: '1.9.1', date: '2026-06-14', changes: [
    '翻页彻底重写：渲染全部段落+DOM实测高度分页+translateY定位',
    '修复滑动弹回：swipe用translateX偏移，松手后CSS transition动画到新页',
    '内容区touchAction:none防止WebView默认手势干扰'
  ]},
  { version: '1.9.0', date: '2026-06-14', changes: [
    'OTA彻底修复：版本号编译进JS bundle，不再依赖运行时fetch',
    'OTA检查添加XMLHttpRequest超时兜底（WebView fetch可能失效）',
    '翻页分页useEffect替代useRef+底部安全距离修复'
  ]},
  { version: '1.8.0', date: '2026-06-14', changes: [
    '左右翻页改为分页模式：文字自动切割成页，左右滑动翻页（非逐章切换）',
    '书籍详情页显示内容标签（短篇/校园/情感等），移除格式标签',
    '书籍缩略图无封面时完整显示书名（支持换行）',
    '阅读底栏显示页码+章节进度',
    'OTA更新检查：fetch超时保护+错误toast提示'
  ]},
  { version: '1.6.6', date: '2026-06-14', changes: [
    '彻查清理垃圾代码：删除scripts/爬虫脚本、占位书籍、无用组件、临时文件',
    '修复db.ts未使用导入，index.json移除无效书籍条目',
    '重建APK确保版本号正确'
  ]},
  { version: '1.6.5', date: '2026-06-14', changes: [
    '修复系统右滑返回：cap sync注册@capacitor/app插件（capacitor.plugins.json为空导致插件未加载）',
    '重新构建APK，删除设置页刷新按钮，OTA更新时清理旧缓存'
  ]},
  { version: '1.6.4', date: '2026-06-14', changes: [
    '删除设置页「刷新页面」按钮（会导致版本倒退）', 'OTA更新时清理旧assets缓存，防止reload加载旧JS'
  ]},
  { version: '1.6.3', date: '2026-06-14', changes: [
    '修复系统右滑返回手势：用Capacitor backButton事件替代popstate'
  ]},
  { version: '1.6.2', date: '2026-06-14', changes: [
    '二级页面（关于/书籍详情/缓存管理/阅读器）支持系统右滑返回手势'
  ]},
  { version: '1.6.1', date: '2026-06-14', changes: [
    '检查更新无新版本时弹窗显示「当前已是最新版本 vX.Y.Z」'
  ]},
  { version: '1.6.0', date: '2026-06-14', changes: [
    '设置页重构：去掉阅读设置（保留在阅读界面右上角），改为全局设置',
    '新增：自动检查更新开关、刷新页面、清除所有数据、设备信息',
    '设置项分组展示（通用/存储/关于）+ iOS风格列表样式'
  ]},
  { version: '1.5.7', date: '2026-06-14', changes: [
    'OTA检查等待ServiceWorker就绪后再发请求（不再首次失败）', 'jsDelivr CDN优先（国内更稳定）', '版本号读取与SW就绪同步'
  ]},
  { version: '1.5.6', date: '2026-06-14', changes: [
    '修复设置页黑屏：Settings全字段null安全兜底 + ErrorBoundary防崩溃',
    '崩溃时显示错误信息和「清除数据并重启」按钮'
  ]},
  { version: '1.5.5', date: '2026-06-14', changes: [
    '启动时预热ServiceWorker，2秒后弹窗提示有新版本可更新'
  ]},
  { version: '1.5.4', date: '2026-06-14', changes: [
    '修复设置页黑屏：旧localStorage缺少brightness/paragraphSpacing字段时用默认值兜底'
  ]},
  { version: '1.5.3', date: '2026-06-14', changes: [
    'OTA更新检查首次失败修复：去掉AbortController超时，改为3次递增延迟重试（2s/4s/6s）'
  ]},
  { version: '1.5.2', date: '2026-06-14', changes: [
    '阅读底栏去掉重复的「设置」按钮（保留顶栏设置）', '设置页去掉存储信息显示区', '新增阅读内容宽度设置（窄/标准/宽/全屏）'
  ]},
  { version: '1.5.1', date: '2026-06-14', changes: [
    '设置页新增阅读器设置（字体/行距/段距/亮度/主题/字体族）', 'OTA首次检查失败自动重试（1.5s延迟后二次尝试）', '阅读内容区亮度调节（CSS filter）', '滚动条全面屏手势条适配', '移除旧版清除缓存按钮（统一用缓存管理）'
  ]},
  { version: '1.5.0', date: '2026-06-14', changes: [
    '书籍详情页新增「缓存」按钮，后台逐章缓存到本地', '设置新增缓存管理二级界面（查看/删除已缓存书籍）', 'OTA更新完成后弹窗提示（不再直接reload）', '阅读器内容区全面屏上下安全区间距修正'
  ]},
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
  onOtaSuccess?: (version: string) => void
}

export default function About({ currentVersion, showToast, onClose, onOtaSuccess }: Props) {
  const [checking, setChecking] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null)
  const [remoteDesc, setRemoteDesc] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [showLatest, setShowLatest] = useState(false)
  const [expandedVer, setExpandedVer] = useState<string | null>('2.0.2')
  const [debugLog, setDebugLog] = useState('')

  const checkUpdate = useCallback(async () => {
    setChecking(true)
    setErrorMsg('')
    setRemoteVersion(null)
    setDebugLog(`内嵌版本: ${APP_VERSION}\n开始检查...`)

    const result = await checkForUpdates()
    setChecking(false)
    setDebugLog(prev => prev + `\n结果: ${JSON.stringify(result)}`)

    if (result.error) {
      setErrorMsg(result.error)
      showToast(`检查失败: ${result.error}`)
      return
    }
    if (result.hasUpdate) {
      setRemoteVersion(result.version || null)
      setRemoteDesc(result.description || '')
    } else {
      setShowLatest(true)
    }
  }, [showToast])

  const startDownload = useCallback(async () => {
    if (downloading || !remoteVersion) return
    setDownloading(true)
    setDownloadProgress(0)
    try {
      const url = getApkUrl(remoteVersion)
      const result = await AppUpdater.downloadAndInstall({ url, filename: `yellow-v${remoteVersion}.apk` })
      if (result.started) {
        const poll = setInterval(async () => {
          try {
            const p = await AppUpdater.getProgress()
            setDownloadProgress(p.progress)
            if (p.status === 'completed') {
              clearInterval(poll)
            } else if (p.status === 'failed') {
              clearInterval(poll)
              setDownloading(false)
              showToast('下载失败 (code: ' + (p.reason || 'unknown') + ')')
            }
          } catch { clearInterval(poll) }
        }, 500)
      } else {
        setDownloading(false)
        showToast('下载启动失败')
      }
    } catch (e) {
      setDownloading(false)
      showToast('下载失败: ' + (e as Error).message)
    }
  }, [remoteVersion, downloading, showToast])

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
                {downloading ? `下载中 ${downloadProgress}%` : '立即更新'}
              </button>
              {downloading && (
                <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${downloadProgress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
              )}
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

        {/* OTA调试信息 */}
        {debugLog && (
          <div className="card" style={{ padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>OTA调试</div>
            <pre style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>{debugLog}</pre>
          </div>
        )}

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

      {showLatest && (
        <div className="modal-overlay" onClick={() => setShowLatest(false)}>
          <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px' }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: 'rgba(76,175,132,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4caf84" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: 'var(--success)' }}>当前已是最新版本</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20 }}>v{currentVersion}</p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowLatest(false)}>知道了</button>
          </div>
        </div>
      )}
    </div>
  )
}
