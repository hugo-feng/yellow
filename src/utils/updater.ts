declare const __APP_VERSION__: string

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'

const VERSION_URLS = [
  'https://api.github.com/repos/hugo-feng/yellow/contents/version.json?ref=gh-pages',
  'https://raw.githubusercontent.com/hugo-feng/yellow/gh-pages/version.json',
  'https://cdn.jsdelivr.net/gh/hugo-feng/yellow@gh-pages/version.json'
]

export async function waitSWReady() {
  try {
    if ('serviceWorker' in navigator) {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise(r => setTimeout(r, 2000))
      ])
    }
  } catch {}
}

export async function getCurrentVersion(): Promise<string> {
  return APP_VERSION
}

export function getUpdateUrl(): string {
  return VERSION_URLS[0]
}

function xhrGet(url: string, timeout = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(), true)
    xhr.timeout = timeout
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          if (data.content && data.encoding === 'base64') {
            resolve(JSON.parse(atob(data.content.replace(/\s/g, ''))))
          } else {
            resolve(data)
          }
        } catch { reject(new Error('JSON解析失败')) }
      } else { reject(new Error('HTTP ' + xhr.status)) }
    }
    xhr.onerror = () => reject(new Error('网络错误'))
    xhr.ontimeout = () => reject(new Error('超时' + timeout / 1000 + 's'))
    xhr.send()
  })
}

export async function checkForUpdates(): Promise<{
  hasUpdate: boolean
  version?: string
  description?: string
  error?: string
}> {
  const errors: string[] = []
  for (const url of VERSION_URLS) {
    try {
      const remote = await xhrGet(url)
      if (remote && remote.version) {
        const cmp = compareVersions(remote.version, APP_VERSION)
        if (cmp > 0) return { hasUpdate: true, version: remote.version, description: remote.description }
        return { hasUpdate: false }
      }
    } catch (e) { errors.push((e as Error).message) }
  }
  return { hasUpdate: false, error: '更新源不可达: ' + errors.join(', ') }
}

export async function downloadAndApply(): Promise<{ success: boolean; error?: string }> {
  try {
    const htmlUrl = 'https://raw.githubusercontent.com/hugo-feng/yellow/gh-pages/index.html?_t=' + Date.now()
    const xhr = new XMLHttpRequest()
    xhr.open('GET', htmlUrl, true)
    xhr.timeout = 15000
    const html = await new Promise<string>((resolve, reject) => {
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.responseText) : reject(new Error('HTTP ' + xhr.status))
      xhr.onerror = () => reject(new Error('网络错误'))
      xhr.ontimeout = () => reject(new Error('超时'))
      xhr.send()
    })

    if ('caches' in window) {
      const cache = await caches.open('yellow-' + APP_VERSION)
      await cache.put('/index.html', new Response(html, { headers: { 'Content-Type': 'text/html' } }))
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
