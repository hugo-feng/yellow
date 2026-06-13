let currentVersion = '1.0.0'

const UPDATE_URLS = [
  'https://raw.githubusercontent.com/hugo-feng/yellow/gh-pages/version.json',
  'https://cdn.jsdelivr.net/gh/hugo-feng/yellow@gh-pages/version.json'
]

let activeBaseUrl = ''
let activeVersionUrl = ''

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

export function getUpdateUrl(): string {
  return activeVersionUrl || UPDATE_URLS[0]
}

async function fetchWithFallback(path: string): Promise<Response> {
  if (activeBaseUrl) {
    try {
      const resp = await fetch(`${activeBaseUrl}/${path}`, { cache: 'no-cache' })
      if (resp.ok) return resp
    } catch {}
  }
  
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of UPDATE_URLS) {
      try {
        const base = url.replace(/\/version\.json$/, '')
        const resp = await fetch(`${base}/${path}`, { cache: 'no-cache' })
        if (resp.ok) {
          activeBaseUrl = base
          activeVersionUrl = `${base}/version.json`
          return resp
        }
      } catch {}
    }
    if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
  }
  throw new Error('所有更新源不可达')
}

export async function checkForUpdates(updateUrl: string): Promise<{
  hasUpdate: boolean
  version?: string
  description?: string
  error?: string
}> {
  try {
    const response = await fetchWithFallback('version.json')
    const remote = await response.json()
    if (compareVersions(remote.version, currentVersion) > 0) {
      return { hasUpdate: true, version: remote.version, description: remote.description }
    }
    return { hasUpdate: false }
  } catch (err: any) {
    return { hasUpdate: false, error: err.message || '检查更新失败' }
  }
}

export async function downloadAndApply(updateUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 下载新版文件
    const [htmlResp, verResp] = await Promise.all([
      fetchWithFallback('index.html'),
      fetchWithFallback('version.json')
    ])
    
    const html = await htmlResp.text()
    const jsMatch = html.match(/["']([./]*\/assets\/index-[^.]+\.js)["']/)
    if (!jsMatch) throw new Error('无法解析资源文件')
    const jsPath = jsMatch[1].replace(/^\.\//, '/')
    const cssMatch = html.match(/["']([./]*\/assets\/index-[^.]+\.css)["']/)
    
    // 下载 JS 和 CSS
    const dlPromises = [fetchWithFallback(jsPath.startsWith('/') ? jsPath.slice(1) : jsPath)]
    if (cssMatch) {
      const cssPath = cssMatch[1].replace(/^\.\//, '/')
      dlPromises.push(fetchWithFallback(cssPath.startsWith('/') ? cssPath.slice(1) : cssPath))
    }
    const results = await Promise.all(dlPromises)
    for (const r of results) { if (!r.ok) throw new Error(`资源下载失败: ${r.status}`) }

    // 存入 Cache API（Service Worker 会从这里读取）
    if ('caches' in window) {
      const cache = await caches.open('yellow-app-cache')
      
      // 缓存所有新资源（路径需要和请求匹配）
      await Promise.all([
        cache.put('/index.html', new Response(html, { headers: { 'Content-Type': 'text/html' } })),
        cache.put('/version.json', verResp.clone()),
        cache.put(jsPath, new Response(await results[0].blob(), { headers: { 'Content-Type': 'application/javascript' } })),
        cssMatch && results.length > 1 ? cache.put(cssMatch[1].replace(/^\.\//, '/'), new Response(await results[1].blob(), { headers: { 'Content-Type': 'text/css' } })) : Promise.resolve()
      ])
      
      localStorage.setItem('yellow-update-pending', 'true')
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map(Number), p2 = v2.split('.').map(Number)
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    if ((p1[i] || 0) > (p2[i] || 0)) return 1
    if ((p1[i] || 0) < (p2[i] || 0)) return -1
  }
  return 0
}
