let currentVersion = '1.0.0'

const DEFAULT_UPDATE_URL = 'https://raw.githubusercontent.com/hugo-feng/yellow/gh-pages/version.json'
const STORAGE_KEY = 'yellow-update-url'

export async function getCurrentVersion(): Promise<string> {
  try {
    const response = await fetch('version.json')
    const data = await response.json()
    currentVersion = data.version
    return currentVersion
  } catch {
    return currentVersion
  }
}

export async function checkForUpdates(updateUrl: string): Promise<{
  hasUpdate: boolean
  version?: string
  description?: string
  error?: string
}> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(updateUrl, {
      signal: controller.signal,
      cache: 'no-cache'
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return { hasUpdate: false, error: `服务器响应异常: ${response.status}` }
    }

    const remote = await response.json()
    const remoteVersion = remote.version

    if (compareVersions(remoteVersion, currentVersion) > 0) {
      return {
        hasUpdate: true,
        version: remoteVersion,
        description: remote.description
      }
    }

    return { hasUpdate: false }
  } catch (err: any) {
    return {
      hasUpdate: false,
      error: err.message === 'AbortError' ? '连接超时' : `检查失败: ${err.message}`
    }
  }
}

// 从 raw.githubusercontent.com 下载单个文件更新
export async function downloadAndApply(
  updateUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 从 version.json URL 推导出 gh-pages 根路径
    const baseUrl = updateUrl.replace(/\/version\.json$/, '')
    const indexUrl = `${baseUrl}/index.html`

    const response = await fetch(indexUrl, { cache: 'no-cache' })
    if (!response.ok) throw new Error(`下载 index.html 失败: ${response.status}`)

    const html = await response.text()

    // 从 HTML 中提取 JS 和 CSS 文件名
    const cssMatch = html.match(/\/assets\/index-[^.]+\.css/)
    const jsMatch = html.match(/\/assets\/index-[^.]+\.js/)

    if (!jsMatch) throw new Error('无法解析资源文件')

    // 下载 CSS 和 JS
    const downloads: Promise<Response>[] = [
      fetch(`${baseUrl}${jsMatch[0]}`, { cache: 'no-cache' })
    ]
    if (cssMatch) {
      downloads.push(fetch(`${baseUrl}${cssMatch[0]}`, { cache: 'no-cache' }))
    }

    const results = await Promise.all(downloads)
    for (const r of results) {
      if (!r.ok) throw new Error(`资源下载失败: ${r.status}`)
    }

    // 使用 Cache API 存储新版本资源
    if ('caches' in window) {
      const cache = await caches.open('yellow-app-v2')
      await cache.put('/index.html', new Response(html))

      const jsBlob = await results[0].blob()
      await cache.put(jsMatch[0], new Response(jsBlob))

      if (cssMatch && results.length > 1) {
        const cssBlob = await results[1].blob()
        await cache.put(cssMatch[0], new Response(cssBlob))
      }

      // 更新 service worker 或标记待重启
      localStorage.setItem('yellow-update-pending', 'true')
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const a = parts1[i] || 0
    const b = parts2[i] || 0
    if (a > b) return 1
    if (a < b) return -1
  }
  return 0
}

export function getUpdateUrl(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_UPDATE_URL
}

export function setUpdateUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY, url)
}
