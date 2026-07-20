import { useAuth } from './AuthContext';
import LoginPage from './LoginPage';

export default function AuthGate({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="login-page" />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return children;
}
