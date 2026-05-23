import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { api } from '../auth/api';

const LEGACY_LS_KEY = 'classics_learned';

const ProgressContext = createContext(null);

/**
 * Single source of truth for learning progress across all kinds.
 * Provider fetches once on mount; consumers subscribe via useProgress(kind).
 */
export function ProgressProvider({ children }) {
  const [byKind, setByKind] = useState({});   // {classics: Set, menu: Set, ...}
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await api.get('/api/me/progress');
      const next = {};
      for (const [k, slugs] of Object.entries(data || {})) {
        next[k] = new Set(slugs);
      }
      setByKind(next);

      // One-time migration of pre-existing classics_learned from localStorage
      try {
        const raw = localStorage.getItem(LEGACY_LS_KEY);
        if (raw) {
          const legacy = JSON.parse(raw) || [];
          const existing = next.classics || new Set();
          const toPush = legacy.filter((s) => s && !existing.has(s));
          if (toPush.length) {
            await Promise.allSettled(
              toPush.map((slug) =>
                api.post(`/api/me/progress/classics/${encodeURIComponent(slug)}`, {})
                  .then(() => existing.add(slug))
                  .catch(() => null)
              )
            );
            setByKind({ ...next, classics: new Set(existing) });
          }
          localStorage.removeItem(LEGACY_LS_KEY);
        }
      } catch { /* ignore */ }
    } catch {
      setByKind({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = useCallback(async (kind, slug) => {
    const current = byKind[kind] || new Set();
    const was = current.has(slug);
    const nextSet = new Set(current);
    if (was) nextSet.delete(slug); else nextSet.add(slug);
    setByKind({ ...byKind, [kind]: nextSet });

    try {
      if (was) {
        await api.delete(`/api/me/progress/${kind}/${encodeURIComponent(slug)}`);
      } else {
        await api.post(`/api/me/progress/${kind}/${encodeURIComponent(slug)}`, {});
      }
    } catch {
      // Roll back
      setByKind({ ...byKind, [kind]: current });
    }
  }, [byKind]);

  return (
    <ProgressContext.Provider value={{ byKind, loading, toggle }}>
      {children}
    </ProgressContext.Provider>
  );
}

/**
 * Consumer hook. Returns the learned-Set for the given kind plus a
 * scoped toggle. Without `kind`, returns the full state (for the
 * overall summary page).
 */
export function useProgress(kind) {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside ProgressProvider');
  if (kind === undefined) return ctx;  // full state
  return {
    learned: ctx.byKind[kind] || new Set(),
    toggle: (slug) => ctx.toggle(kind, slug),
    loading: ctx.loading,
  };
}
