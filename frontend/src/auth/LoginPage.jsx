import { useState } from 'react';
import { useAuth } from './AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSubmitting(true);
    setError('');
    try {
      await login(username.trim().toLowerCase(), password);
    } catch (err) {
      setError(err.message || 'Не удалось войти');
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          Kollektiv
        </div>
        <div className="login-sub">Закрытая коктейльная карта</div>

        <label className="login-field">
          <span className="login-label">Логин</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            required
          />
        </label>

        <label className="login-field">
          <span className="login-label">Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button
          type="submit"
          className="login-submit"
          disabled={submitting || !username.trim() || !password}
        >
          {submitting ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
