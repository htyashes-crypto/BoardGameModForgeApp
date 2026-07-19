import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { applyThemeFromStorage } from './store/themeStore'
import './styles/globals.css'

// 首屏同步应用主题 class:必须在 render 之前,避免先以默认 dark 渲染再切 light 的闪烁(FOUC)
applyThemeFromStorage()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
