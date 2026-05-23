import { useEffect, useState, useCallback } from 'react';
import { api } from '../auth/api';

const LEGACY_LS_KEY = 'classics_learned';

/**
 * Server-backed learning progress: returns { learned: Set, toggle(slug) }.
 *
 * On first mount fetches the current user's progress from /api/me/progress.
 * On the very first run for an account, also migrates any pre-existing
 * `classics_learned` set from localStorage (legacy client-side state)
 * to the server, then clears the local key.
 */
export function useProgress() {
  const [learned, setLearned] = useState(() => new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const serverList = await api.get('/api/me/progress');
        const merged = new Set(serverList);

        // One-time migration from localStorage
        let legacy = [];
        try {
          const raw = localStorage.getItem(LEGACY_LS_KEY);
          if (raw) legacy = JSON.parse(raw) || [];
        } catch { /* ignore */ }

        const toPush = legacy.filter((slug) => slug && !merged.has(slug));
        if (toPush.length > 0) {
          // Push in parallel; unknown slugs are 404'd and ignored.
          await Promise.allSettled(
            toPush.map((slug) =>
              api.post(`/api/me/progress/${encodeURIComponent(slug)}`, {})
                .then(() => merged.add(slug))
                .catch(() => null)
            )
          );
        }
        if (legacy.length > 0) {
          try { localStorage.removeItem(LEGACY_LS_KEY); } catch { /* ignore */ }
        }

        if (!cancelled) setLearned(merged);
      } catch {
        // 401 or network error — show empty progress; mutations will fail loudly.
        if (!cancelled) setLearned(new Set());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback(async (slug) => {
    // Optimistic update
    const wasLearned = learned.has(slug);
    const next = new Set(learned);
    if (wasLearned) next.delete(slug); else next.add(slug);
    setLearned(next);

    try {
      if (wasLearned) {
        await api.delete(`/api/me/progress/${encodeURIComponent(slug)}`);
      } else {
        await api.post(`/api/me/progress/${encodeURIComponent(slug)}`, {});
      }
    } catch {
      // Roll back on failure
      setLearned(learned);
    }
  }, [learned]);

  return { learned, toggle, loading };
}
