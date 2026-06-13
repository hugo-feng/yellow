let currentVersion = '1.0.0'

const UPDATE_URLS = [
  'https://cdn.jsdelivr.net/gh/hugo-feng/yellow@gh-pages/version.json',
  'https://raw.githubusercontent.com/hugo-feng/yellow/gh-pages/version.json'
]

let activeBaseUrl = ''
let activeVersionUrl = ''
let swReady = false

export async function waitSWReady() {
  if (swReady) return
  try {
    if ('serviceWorker' in navigator) {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise(r => setTimeout(r, 5000))
      ])
    }
  } catch {}
  swReady = true
}

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

function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`请求超时(${timeoutMs / 1000}s)`)), timeoutMs)
    fetch(url, { cache: 'no-cache' })
      .then(resp => { clearTimeout(timer); resolve(resp) })
      .catch(err => { clearTimeout(timer); reject(err) })
  })
}

async function fetchWithFallback(path: string): Promise<Response> {
  if (activeBaseUrl) {
    try {
      const resp = await fetchWithTimeout(`${activeBaseUrl}/${path}`)
      if (resp.ok) return resp
    } catch (e) { console.warn('[OTA] 活跃源失败:', (e as Error).message) }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of UPDATE_URLS) {
      try {
        const base = url.replace(/\/version\.json$/, '')
        const resp = await fetchWithTimeout(`${base}/${path}`)
        if (resp.ok) {
          activeBaseUrl = base
          activeVersionUrl = `${base}/version.json`
          return resp
        }
        console.warn(`[OTA] ${url} 响应 ${resp.status}`)
      } catch (e) { console.warn(`[OTA] ${url} 失败:`, (e as Error).message) }
    }
    if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
  }
  throw new Error('所有更新源不可达（已重试3次）')
}

export async function checkForUpdates(updateUrl: string): Promise<{
  hasUpdate: boolean
  version?: string
  description?: string
  error?: string
}> {
  try {
    await waitSWReady()
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
    await waitSWReady()
    const [htmlResp, verResp] = await Promise.all([
      fetchWithFallback('index.html'),
      fetchWithFallback('version.json')
    ])
    
    const html = await htmlResp.text()
    const jsMatch = html.match(/["']([./]*\/assets\/index-[^.]+\.js)["']/)
    if (!jsMatch) throw new Error('无法解析资源文件')
    const jsPath = jsMatch[1].replace(/^\.\//, '/')
    const cssMatch = html.match(/["']([./]*\/assets\/index-[^.]+\.css)["']/)
    
    const dlPromises = [fetchWithFallback(jsPath.startsWith('/') ? jsPath.slice(1) : jsPath)]
    if (cssMatch) {
      const cssPath = cssMatch[1].replace(/^\.\//, '/')
      dlPromises.push(fetchWithFallback(cssPath.startsWith('/') ? cssPath.slice(1) : cssPath))
    }
    const results = await Promise.all(dlPromises)
    for (const r of results) { if (!r.ok) throw new Error(`资源下载失败: ${r.status}`) }

    if ('caches' in window) {
      const cache = await caches.open('yellow-app-cache')
      
      // 删除旧的 assets 缓存（防止 reload 时加载旧 JS/CSS）
      const oldKeys = await cache.keys()
      for (const req of oldKeys) {
        const p = new URL(req.url).pathname
        if (p.startsWith('/assets/') || p === '/index.html' || p === '/version.json') {
          await cache.delete(req)
        }
      }
      
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
