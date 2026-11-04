import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Flex, SkipNavContent, SkipNavLink } from '@chakra-ui/react'
import Home from './pages/Home.jsx'
import Ask from './pages/Ask.jsx'
import Profile from './pages/Profile.jsx'
import PlaceDetail from './pages/PlaceDetail.jsx'
import MyReviews from './pages/MyReviews.jsx'
import CollectionDetail from './pages/CollectionDetail.jsx'
import SharedCollection from './pages/SharedCollection.jsx'
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

// Which tab each page belongs to. Routes match case-insensitively and ignore a trailing slash.
const TAB_OF = { '/': '/', '/ask': '/ask', '/profile': '/profile', '/profile/reviews': '/profile', '/onboarding': '/profile', '/auth/callback': '/profile' }

function AppLayout() {
  const { pathname } = useLocation()
  const path = pathname.replace(/\/+$/, '').toLowerCase() || '/'
  const activeTab = TAB_OF[path] ?? (path.startsWith('/profile/collections/') ? '/profile' : null)
  // Pages stretch to fill <main>, so none of them needs to know the header's height.
  return (
    <Flex direction="column" minH="100dvh" css={{
      '--bottom-nav-space': { base: `calc(${NAV_HEIGHT} + env(safe-area-inset-bottom))`, md: '0px' },
    }} pb="var(--bottom-nav-space)">
      <SkipNavLink id="main-content" zIndex="skipNav">Skip to content</SkipNavLink>
      <SiteHeader activeTab={activeTab} path={path} />
      <SkipNavContent as="main" id="main-content" flex="1" display="flex" flexDirection="column">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/reviews" element={<MyReviews />} />
          <Route path="/profile/collections/:id" element={<CollectionDetail />} />
          <Route path="/collections/shared/:token" element={<SharedCollection />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/auth/callback" element={<Profile />} />
          <Route path="/places/:id" element={<PlaceDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </SkipNavContent>
      <BottomNav activeTab={activeTab} path={path} />
    </Flex>
  )
}
