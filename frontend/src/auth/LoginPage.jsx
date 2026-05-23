import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef(null);

  // When an error appears, clear the password and refocus it so the
  // user can retype immediately. Fixes "stuck on error" frustration.
  useEffect(() => {
    if (error && passwordRef.current) {
      passwordRef.current.focus();
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await login(username.trim().toLowerCase(), password);
    } catch (err) {
      setError(err?.message || 'Неверный логин или пароль');
      setPassword('');     // clear so the user can retype
    } finally {
      setSubmitting(false); // guarantee form re-enables even if rendering throws
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit} noValidate>
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
            disabled={submitting}
          />
        </label>

        <label className="login-field">
          <span className="login-label">Пароль</span>
          <input
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={submitting}
          />
        </label>

        {error && (
          <div className="login-error" role="alert">
            {error} — попробуйте ещё раз
          </div>
        )}

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
