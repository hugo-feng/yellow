declare global {
  interface Window {
    NativeDownloader?: {
      download(url: string, filename: string, version: string): void
      getProgress(): number
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
      if (status === 'started') resolve()
      else if (status === 'failed') reject(new Error('下载失败'))
    }

    window.NativeDownloader.download(url, filename, version)
  })
}

export function getNativeProgress(): number {
  return window.NativeDownloader?.getProgress() ?? -1
}
