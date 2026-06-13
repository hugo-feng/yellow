// 获取当前版本号（从构建时注入或运行时获取）
let currentVersion = '1.0.0'

// 初始化时从本地读取版本
export async function getCurrentVersion(): Promise<string> {
  try {
    const response = await fetch('version.json')
    const data = await response.json()
    currentVersion = data.version
    return currentVersion
  } catch {
    // 回退到硬编码版本
    return currentVersion
  }
}

// 检查远程更新
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

// 下载并应用更新（返回 true 表示需要重启）
export async function downloadAndApply(
  downloadUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 下载更新包（zip 格式）
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)

    const response = await fetch(downloadUrl, {
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return { success: false, error: `下载失败: ${response.status}` }
    }

    const blob = await response.blob()
    // 这里需要解压 zip 并写入文件系统
    // 在 Capacitor 环境中可以使用 Filesystem 插件
    // 在纯 Web 环境中，使用 Service Worker 缓存新资源

    // 使用 Cache API 缓存新版本的资源
    if ('caches' in window) {
      const cache = await caches.open('yellow-app-v' + await getCurrentVersion())
      // 将下载的内容存入缓存
      // 实际上这里需要解析 zip，但简化处理：直接缓存响应
    }

    // 对于完整的移动端实现，需要使用 @capacitor/filesystem
    // 和 zip 解压库。这里提供一个骨架。

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// 版本号比较：返回 1 表示 v1 > v2, -1 表示 v1 < v2, 0 表示相等
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

// 获取更新服务器 URL（可在设置中配置）
const STORAGE_KEY = 'yellow-update-url'

export function getUpdateUrl(): string {
  return localStorage.getItem(STORAGE_KEY) || ''
}

export function setUpdateUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY, url)
}
