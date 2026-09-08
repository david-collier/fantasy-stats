import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'
import { MyTeamProvider } from './data/myTeam'
import Home from './pages/Home'
import Matchups from './pages/Matchups'
import History from './pages/History'
import SeasonDetail from './pages/SeasonDetail'
import HeadToHead from './pages/HeadToHead'
import Teams from './pages/Teams'
import TeamPage from './pages/TeamPage'
import Players from './pages/Players'
import PlayerPage from './pages/PlayerPage'
import Stats from './pages/Stats'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MyTeamProvider>
      <HashRouter>
        <Routes>
          <Route element={<App />}>
            <Route index element={<Home />} />
            <Route path="standings/:season" element={<Home />} />
            <Route path="matchups" element={<Matchups />} />
            <Route path="matchups/:season" element={<Matchups />} />
            <Route path="matchups/:season/:period" element={<Matchups />} />
            <Route path="season/:season" element={<SeasonDetail />} />
            <Route path="history" element={<History />} />
            <Route path="h2h" element={<HeadToHead />} />
            <Route path="teams" element={<Teams />} />
            <Route path="team/:franchiseId" element={<TeamPage />} />
            <Route path="players" element={<Players />} />
            <Route path="player/:playerId" element={<PlayerPage />} />
            <Route path="stats" element={<Stats />} />
            <Route path="stats/:season" element={<Stats />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </MyTeamProvider>
  </StrictMode>,
)
