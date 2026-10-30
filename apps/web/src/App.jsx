import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
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
            <AppLayout />
          </AskProvider>
        </SavedPlacesProvider>
      </SessionProvider>
    </BrowserRouter>
  )
}

function AppLayout() {
  const { pathname } = useLocation()
  const activeTab = ['/profile', '/onboarding', '/auth/callback'].includes(pathname)
    ? '/profile' : pathname === '/ask' ? '/ask' : pathname === '/' ? '/' : null
  return (
    <Box minH="100dvh" css={{
      '--bottom-nav-space': { base: `calc(${NAV_HEIGHT} + env(safe-area-inset-bottom))`, md: '0px' },
    }} pb="var(--bottom-nav-space)">
      <SiteHeader activeTab={activeTab} />
      <Box as="main" id="main-content">
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
      <BottomNav activeTab={activeTab} />
    </Box>
  )
}
