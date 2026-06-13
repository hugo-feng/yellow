import { useState, useCallback } from 'react'
import { checkForUpdates, getCurrentVersion, getUpdateUrl } from '../utils/updater'

interface Props {
  showToast: (msg: string) => void
  currentVersion: string
}

export default function UpdateChecker({ showToast, currentVersion }: Props) {
  const [checking, setChecking] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null)
  const [remoteDescription, setRemoteDescription] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const checkUpdate = useCallback(async () => {
    const url = getUpdateUrl()
    if (!url) {
      showToast('请先配置更新源地址')
      return
    }

    setChecking(true)
    setErrorMsg('')
    setRemoteVersion(null)

    const result = await checkForUpdates(url)
    setChecking(false)

    if (result.error) {
      setErrorMsg(result.error)
      return
    }

    if (result.hasUpdate) {
      setRemoteVersion(result.version || null)
      setRemoteDescription(result.description || '')
    } else {
      showToast('已是最新版本 ✓')
    }
  }, [showToast])

  const startDownload = useCallback(async () => {
    setDownloading(true)
    const downloadZipUrl = getUpdateUrl().replace('version.json', 'update.zip')
    try {
      const response = await fetch(downloadZipUrl)
      if (!response.ok) throw new Error(`下载失败 (${response.status})`)
      const blob = await response.blob()

      // 使用 Cache API 缓存更新包
      if ('caches' in window) {
        const cache = await caches.open('yellow-update-cache')
        await cache.put('/update-pending', new Response(blob))
        showToast('更新已就绪，重启应用后生效')
        setTimeout(() => window.location.reload(), 2000)
      } else {
        throw new Error('浏览器不支持 Cache API')
      }
    } catch (err: any) {
      setErrorMsg(err.message || '下载失败')
      showToast('更新失败')
    } finally {
      setDownloading(false)
    }
  }, [showToast])

  const hasUpdate = remoteVersion !== null

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>版本更新</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            当前 v{currentVersion}
          </div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={checkUpdate}
          disabled={checking || downloading}
          style={{ whiteSpace: 'nowrap' }}
        >
          {checking ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> 检查中
            </span>
          ) : '检查更新'}
        </button>
      </div>

      {hasUpdate && (
        <div className="scale-in" style={{
          background: 'var(--accent-glow)',
          border: '1px solid rgba(240,192,64,0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          marginBottom: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 14 }}>
              发现新版本 v{remoteVersion}
            </span>
          </div>
          {remoteDescription && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, marginLeft: 24 }}>
              {remoteDescription}
            </div>
          )}
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              v{currentVersion} → v{remoteVersion}
            </span>
          </div>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: 10, width: '100%' }}
            onClick={startDownload}
            disabled={downloading}
          >
            {downloading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> 下载中...
              </span>
            ) : '立即更新'}
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="fade-in" style={{
          background: 'rgba(224,85,85,0.1)',
          border: '1px solid rgba(224,85,85,0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          fontSize: 12,
          color: 'var(--danger)'
        }}>
          {errorMsg}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        在下方配置更新源地址后，点击「检查更新」即可检测远程版本。
      </div>
    </div>
  )
}
