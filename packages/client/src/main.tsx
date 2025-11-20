import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './theme.css'
import './global.css'
import { initInspector } from './lib/inspector'

// Initialize XState inspector (dev only, auto-enabled in development)
initInspector()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
