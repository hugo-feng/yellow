declare const __APP_VERSION__: string

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'

const VERSION_URLS = [
  'https://api.github.com/repos/hugo-feng/yellow/contents/version.json?ref=gh-pages',
  'https://raw.githubusercontent.com/hugo-feng/yellow/gh-pages/version.json',
  'https://cdn.jsdelivr.net/gh/hugo-feng/yellow@gh-pages/version.json'
]

export interface UpdateInfo {
  version: string
  versionCode?: number
  downloadUrl: string
  updateContent: string
}

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
            const binary = atob(data.content.replace(/\s/g, ''))
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
            resolve(JSON.parse(new TextDecoder('utf-8').decode(bytes)))
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
  updateInfo?: UpdateInfo
  error?: string
}> {
  const errors: string[] = []
  for (const url of VERSION_URLS) {
    try {
      const remote = await xhrGet(url)
      if (remote && remote.version) {
        const cmp = compareVersions(remote.version, APP_VERSION)
        if (cmp > 0) {
          return {
            hasUpdate: true,
            updateInfo: {
              version: remote.version,
              versionCode: remote.versionCode,
              downloadUrl: remote.downloadUrl || `https://ghfast.top/https://github.com/hugo-feng/yellow/releases/download/v${remote.version}/yellow-v${remote.version}.apk`,
              updateContent: remote.updateContent || remote.description || '有新的功能和改进可用'
            }
          }
        }
        return { hasUpdate: false }
      }
    } catch (e) { errors.push((e as Error).message) }
  }
  return { hasUpdate: false, error: '更新源不可达: ' + errors.join(', ') }
}

function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map(Number), p2 = v2.split('.').map(Number)
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    if ((p1[i] || 0) > (p2[i] || 0)) return 1
    if ((p1[i] || 0) < (p2[i] || 0)) return -1
  }
  return 0
}
