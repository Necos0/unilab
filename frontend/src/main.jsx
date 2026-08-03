import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LaneBattleGate from './features/lanebattle/LaneBattleGate.jsx'
import disableBrowserZoom from './disableBrowserZoom.js'

disableBrowserZoom()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <LaneBattleGate />
  </StrictMode>,
)
