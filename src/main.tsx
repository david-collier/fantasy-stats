import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'
import Home from './pages/Home'
import Matchups from './pages/Matchups'
import History from './pages/History'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Home />} />
          <Route path="standings/:season" element={<Home />} />
          <Route path="matchups" element={<Matchups />} />
          <Route path="matchups/:season" element={<Matchups />} />
          <Route path="matchups/:season/:period" element={<Matchups />} />
          <Route path="history" element={<History />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
)
