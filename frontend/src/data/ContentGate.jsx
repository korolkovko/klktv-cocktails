import { useContent } from './ContentContext';

export default function ContentGate({ children }) {
  const { loading, error, reload, cocktails } = useContent();

  // Only block render on the FIRST load (when we have no bundle yet).
  // Subsequent reloads (after an admin edit) must keep the UI mounted —
  // otherwise the page state in <App> resets to the default category.
  if (loading && !cocktails) {
    return (
      <div className="login-page">
        <div className="login-sub" style={{ textAlign: 'center' }}>Загружаем карту…</div>
      </div>
    );
  }

  if (error && !cocktails) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">Ошибка</div>
          <div className="login-sub">Не удалось загрузить данные{error ? `: ${error}` : ''}</div>
          <button className="login-submit" onClick={reload}>Повторить</button>
        </div>
      </div>
    );
  }

  return cocktails ? children : null;
}
