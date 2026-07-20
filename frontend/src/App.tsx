import CocktailGuidePage from '@/pages/cocktail-guide/page'
import { AuthProvider, useAuth } from '@/auth/AuthContext'
import { AuthGate } from '@/auth/AuthGate'
import { ContentProvider } from '@/data/ContentContext'
import { ProgressProvider } from '@/data/ProgressContext'

// AuthGate only renders children once `user` has resolved to non-null (see
// AuthGate.tsx), so `user!` below is safe. ContentProvider must sit inside
// AuthGate (not around it) — /api/content requires auth (blueprint §D).
function Shell() {
  const { user, logout } = useAuth()
  return (
    <ContentProvider>
      <ProgressProvider>
        <CocktailGuidePage user={user!} onSignOut={logout} />
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
