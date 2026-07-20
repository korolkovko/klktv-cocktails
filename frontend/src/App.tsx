import CocktailGuidePage from '@/pages/cocktail-guide/page'
import { AuthProvider, useAuth } from '@/auth/AuthContext'
import { AuthGate } from '@/auth/AuthGate'
import { ContentProvider } from '@/data/ContentContext'
import { ProgressProvider } from '@/data/ProgressContext'
import { useUrlRoute } from '@/lib/useUrlRoute'

// AuthGate only renders children once `user` has resolved to non-null (see
// AuthGate.tsx), so `user!` below is safe. ContentProvider must sit inside
// AuthGate (not around it) — /api/content requires auth (blueprint §D).
function Shell() {
  const { user, logout } = useAuth()
  // Task 6: real URLs (History API) instead of in-memory-only route state —
  // controlled route/onRouteChange threaded into the block (blueprint §D).
  const { route, onRouteChange } = useUrlRoute()
  return (
    <ContentProvider>
      <ProgressProvider>
        <CocktailGuidePage route={route} onRouteChange={onRouteChange} user={user!} onSignOut={logout} />
      </ProgressProvider>
    </ContentProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <Shell />
      </AuthGate>
    </AuthProvider>
  )
}

export default App
