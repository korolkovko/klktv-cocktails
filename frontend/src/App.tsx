import * as React from 'react'

import CocktailGuidePage from '@/pages/cocktail-guide/page'
import { AuthProvider, useAuth } from '@/auth/AuthContext'
import { AuthGate } from '@/auth/AuthGate'
import { ContentProvider } from '@/data/ContentContext'
import { ProgressProvider } from '@/data/ProgressContext'
import { useUrlRoute } from '@/lib/useUrlRoute'
import AdminPage from '@/admin/AdminPage'

function isAdminPath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

// AuthGate only renders children once `user` has resolved to non-null (see
// AuthGate.tsx), so `user!` below is safe. ContentProvider must sit inside
// AuthGate (not around it) — /api/content requires auth (blueprint §D).
function Shell() {
  const { user, logout } = useAuth()
  // Task 6: real URLs (History API) instead of in-memory-only route state —
  // controlled route/onRouteChange threaded into the block (blueprint §D).
  const { route, onRouteChange } = useUrlRoute()

  // Task 7: /admin is a separate top-level shell, gated by role (editor or
  // admin only — readers get bounced back to the guide). It's a hard
  // navigation from the guest shell (window.location.assign), not a `Route`
  // value, so it's read straight off window.location rather than useUrlRoute.
  const onAdminPath = isAdminPath(window.location.pathname)
  const isReader = user!.role === 'reader'

  React.useEffect(() => {
    if (onAdminPath && isReader) {
      history.replaceState(null, '', '/')
    }
  }, [onAdminPath, isReader])

  if (onAdminPath && !isReader) {
    return <AdminPage />
  }

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
