import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LaneBattleGate from './features/lanebattle/LaneBattleGate.jsx'
import disableBrowserZoom from './disableBrowserZoom.js'
import disableContextMenu from './disableContextMenu.js'
import ClearScreen from './features/screen/ClearScreen.jsx'

disableBrowserZoom()
disableContextMenu()

/* 会場モニター用の集計スクリーン。`/screen` で開いたときはゲームを出さない。 */
const isClearScreen = window.location.pathname.replace(/\/+$/, '') === '/screen'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isClearScreen ? (
      <ClearScreen />
    ) : (
      <>
        <App />
        <LaneBattleGate />
      </>
    )}
  </StrictMode>,
)
