declare global {
  interface Window {
    NativeDownloader?: {
      download(url: string, filename: string, version: string): void
      getProgress(): number
      isDownloading(): boolean
      install(): boolean
    }
    __nativeDownloadCallback?: (status: string) => void
  }
}

export function isNativeDownloaderAvailable(): boolean {
  return !!window.NativeDownloader
}

export function nativeDownload(url: string, filename: string, version: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.NativeDownloader) {
      reject(new Error('NativeDownloader not available'))
      return
    }

    window.__nativeDownloadCallback = (status: string) => {
      if (status === 'started' || status.startsWith('progress:')) {
        resolve()
      } else if (status === 'completed') {
        resolve()
      } else if (status.startsWith('failed')) {
        const msg = status.includes(':') ? status.split(':')[1] : '下载失败'
        reject(new Error(msg))
      }
    }

    window.NativeDownloader.download(url, filename, version)
    // Resolve immediately since download starts async
    resolve()
  })
}

export function getNativeProgress(): number {
  return window.NativeDownloader?.getProgress() ?? -1
}

export function installDownloaded(): boolean {
  return window.NativeDownloader?.install() ?? false
}
