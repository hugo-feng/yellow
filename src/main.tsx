import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

// 注册 Service Worker 用于 OTA 更新拦截
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
}

// 全面屏安全区 JS 兜底检测
// CSS 已有 env(safe-area-inset-top, 24px) 回退，这里做二次确认
function detectSafeArea() {
  const root = document.documentElement
  // 如果支持 env() 且返回值 > 0，就用 env()；否则用 24px（Android 标准状态栏）
  const testEl = document.createElement('div')
  testEl.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top,24px);pointer-events:none;visibility:hidden'
  document.body.appendChild(testEl)
  const envTop = testEl.offsetHeight
  document.body.removeChild(testEl)
  
  if (envTop > 0) {
    root.style.setProperty('--safe-top-real', `${envTop}px`)
  } else {
    // env() 无效，用 JS 推测
    const estimatedTop = (window.screen?.height || 0) - (window.innerHeight || 0)
    const safeTop = Math.max(24, Math.min(estimatedTop, 60))
    root.style.setProperty('--safe-top-real', `${safeTop}px`)
  }
}

// 等 DOM ready 后检测
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectSafeArea)
} else {
  detectSafeArea()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
