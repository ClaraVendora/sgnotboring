import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Box } from '@chakra-ui/react'
import Home from './pages/Home.jsx'
import Ask from './pages/Ask.jsx'
import Profile from './pages/Profile.jsx'
import PlaceDetail from './pages/PlaceDetail.jsx'
import NotFound from './pages/NotFound.jsx'
import BottomNav, { NAV_HEIGHT } from './components/BottomNav.jsx'
import SiteHeader from './components/SiteHeader.jsx'
import Onboarding from './pages/Onboarding.jsx'
import { SessionProvider } from './hooks/SessionProvider.jsx'
import { SavedPlacesProvider } from './hooks/SavedPlacesProvider.jsx'
import { AskProvider } from './hooks/AskProvider.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <SavedPlacesProvider>
          <AskProvider>
            {/* bottom padding keeps page content clear of the fixed tab bar */}
            <Box minH="100dvh" pb={`calc(${NAV_HEIGHT} + env(safe-area-inset-bottom))`}>
              <SiteHeader />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/ask" element={<Ask />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/auth/callback" element={<Profile />} />
                <Route path="/places/:id" element={<PlaceDetail />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Box>
            <BottomNav />
          </AskProvider>
        </SavedPlacesProvider>
      </SessionProvider>
    </BrowserRouter>
  )
}
