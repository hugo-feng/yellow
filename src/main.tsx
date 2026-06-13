import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { Toaster } from 'sonner'
import './styles/index.css'

declare const __APP_VERSION__: string
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  }
})

// Version change detection: clear SW cache on app update
const lastVersion = localStorage.getItem('yellow-app-version')
if (lastVersion && lastVersion !== APP_VERSION) {
  console.log(`[App] Version changed: ${lastVersion} → ${APP_VERSION}, clearing caches...`)
  if ('caches' in window) {
    caches.keys().then(keys => {
      const deletions = keys.map(k => caches.delete(k))
      Promise.all(deletions).then(() => {
        localStorage.setItem('yellow-app-version', APP_VERSION)
        // Unregister old SW and reload
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(regs => {
            regs.forEach(r => r.unregister())
            window.location.reload()
          })
        }
      })
    })
  }
} else {
  localStorage.setItem('yellow-app-version', APP_VERSION)
}

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
}

// Full screen safe area detection
function detectSafeArea() {
  const root = document.documentElement
  const testEl = document.createElement('div')
  testEl.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top,24px);pointer-events:none;visibility:hidden'
  document.body.appendChild(testEl)
  const envTop = testEl.offsetHeight
  document.body.removeChild(testEl)

  if (envTop > 0) {
    root.style.setProperty('--safe-top-real', `${envTop}px`)
  } else {
    const estimatedTop = (window.screen?.height || 0) - (window.innerHeight || 0)
    const safeTop = Math.max(24, Math.min(estimatedTop, 60))
    root.style.setProperty('--safe-top-real', `${safeTop}px`)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectSafeArea)
} else {
  detectSafeArea()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
    <Toaster position="top-center" richColors closeButton duration={2000} />
  </React.StrictMode>
)
