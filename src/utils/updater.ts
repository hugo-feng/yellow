let currentVersion = '1.0.0'

const UPDATE_URL = 'https://raw.githubusercontent.com/hugo-feng/yellow/gh-pages/version.json'

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
  return UPDATE_URL
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
    const response = await fetch(updateUrl, { signal: controller.signal, cache: 'no-cache' })
    clearTimeout(timeout)
    if (!response.ok) return { hasUpdate: false, error: `服务器响应异常: ${response.status}` }
    const remote = await response.json()
    if (compareVersions(remote.version, currentVersion) > 0) {
      return { hasUpdate: true, version: remote.version, description: remote.description }
    }
    return { hasUpdate: false }
  } catch (err: any) {
    return { hasUpdate: false, error: err.message === 'AbortError' ? '连接超时' : `检查失败: ${err.message}` }
  }
}

export async function downloadAndApply(updateUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = updateUrl.replace(/\/version\.json$/, '')
    
    // 下载新版本文件
    const [htmlResp, verResp] = await Promise.all([
      fetch(`${baseUrl}/index.html`, { cache: 'no-cache' }),
      fetch(updateUrl, { cache: 'no-cache' })
    ])
    if (!htmlResp.ok) throw new Error(`下载 index.html 失败: ${htmlResp.status}`)
    
    const html = await htmlResp.text()
    const jsMatch = html.match(/\/assets\/index-[^.]+\.js/)
    if (!jsMatch) throw new Error('无法解析资源文件')
    const cssMatch = html.match(/\/assets\/index-[^.]+\.css/)
    
    // 下载 JS 和 CSS
    const dlPromises = [fetch(`${baseUrl}${jsMatch[0]}`, { cache: 'no-cache' })]
    if (cssMatch) dlPromises.push(fetch(`${baseUrl}${cssMatch[0]}`, { cache: 'no-cache' }))
    const results = await Promise.all(dlPromises)
    for (const r of results) { if (!r.ok) throw new Error(`资源下载失败: ${r.status}`) }

    // 存入 Cache API（Service Worker 会从这里读取）
    if ('caches' in window) {
      const cache = await caches.open('yellow-app-cache')
      
      // 缓存所有新资源（路径需要和请求匹配）
      await Promise.all([
        cache.put('/index.html', new Response(html, { headers: { 'Content-Type': 'text/html' } })),
        cache.put('/version.json', verResp.clone()),
        cache.put(jsMatch[0], new Response(await results[0].blob(), { headers: { 'Content-Type': 'application/javascript' } })),
        cssMatch && results.length > 1 ? cache.put(cssMatch[0], new Response(await results[1].blob(), { headers: { 'Content-Type': 'text/css' } })) : Promise.resolve()
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
