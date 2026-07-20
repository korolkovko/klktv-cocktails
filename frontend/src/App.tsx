import CocktailGuidePage from '@/pages/cocktail-guide/page'
import { AuthProvider } from '@/auth/AuthContext'
import { AuthGate } from '@/auth/AuthGate'

function App() {
  return (
    <AuthProvider>
      <AuthGate>
        {/* ContentProvider + block wiring lands in Task 4 */}
        <CocktailGuidePage />
      </AuthGate>
    </AuthProvider>
  )
}

export default App
