import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext'
import AuthGate from './auth/AuthGate'
import { ContentProvider } from './data/ContentContext'
import ContentGate from './data/ContentGate'
import { ProgressProvider } from './data/useProgress'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        <ContentProvider>
          <ContentGate>
            <ProgressProvider>
              <App />
            </ProgressProvider>
          </ContentGate>
        </ContentProvider>
      </AuthGate>
    </AuthProvider>
  </StrictMode>,
)
