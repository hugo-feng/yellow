import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { Toaster } from 'sonner'
import './styles/index.css'

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

// Remove old ServiceWorker and caches (from versions that used SW caching)
// Capacitor WebView loads directly from APK assets, no SW needed
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister())
  })
}
if ('caches' in window) {
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
}

// Full screen safe area detection
function detectSafeArea() {
  const root = document.documentElement

  // Detect top safe area (status bar)
  const testTop = document.createElement('div')
  testTop.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top,0px);pointer-events:none;visibility:hidden;z-index:-1'
  document.body.appendChild(testTop)
  const topH = testTop.offsetHeight
  document.body.removeChild(testTop)
  root.style.setProperty('--safe-top-real', (topH > 0 ? topH : 24) + 'px')

  // Detect bottom safe area (gesture bar / navigation bar)
  const testBottom = document.createElement('div')
  testBottom.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden;z-index:-1'
  document.body.appendChild(testBottom)
  const bottomH = testBottom.offsetHeight
  document.body.removeChild(testBottom)

  if (bottomH > 0) {
    root.style.setProperty('--safe-bottom-real', bottomH + 'px')
  } else {
    // Estimate: if screen height > inner height by a small amount, likely gesture nav
    const diff = (window.screen?.height || 0) - (window.innerHeight || 0)
    // Android gesture bar is typically 16-24px, but innerHeight already accounts for it
    // Use a minimum of 16px for gesture navigation devices
    const safeBottom = Math.max(16, Math.min(diff, 48))
    root.style.setProperty('--safe-bottom-real', safeBottom + 'px')
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
