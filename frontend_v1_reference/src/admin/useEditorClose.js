import { useCallback, useEffect, useRef } from 'react';

const CONFIRM_MESSAGE =
  'Есть несохранённые изменения. Закрыть без сохранения?\n\n' +
  'Все правки в этой карточке будут потеряны.';

/**
 * Editor lifecycle helper used by every admin sheet editor.
 *
 *   const safeClose = useEditorClose(form, onClose);
 *
 * - Locks body scroll while the editor is open.
 * - Captures a baseline snapshot of `form` on first render. Closes
 *   that go through `safeClose` will prompt for confirmation if
 *   the current `form` differs from that baseline (JSON-equality).
 * - Wires up ESC → safeClose.
 * - Also installs a beforeunload guard so a tab close / refresh
 *   warns about unsaved edits.
 *
 * The original `onClose` (no-confirm) should still be called by the
 * editor's submit handler after a successful save.
 */
export function useEditorClose(form, onClose) {
  // Capture baseline ONCE on first render. useRef's initializer runs
  // only on mount, so subsequent renders keep pointing at the original.
  const baselineRef = useRef(null);
  if (baselineRef.current === null) {
    try {
      baselineRef.current = JSON.stringify(form);
    } catch {
      baselineRef.current = '';
    }
  }

  // Keep a ref to the latest form so the memoised safeClose can read
  // it without becoming a new function on every render.
  const formRef = useRef(form);
  formRef.current = form;

  const isDirty = useCallback(() => {
    try {
      return JSON.stringify(formRef.current) !== baselineRef.current;
    } catch {
      return false;
    }
  }, []);

  const safeClose = useCallback(() => {
    // eslint-disable-next-line no-alert
    if (isDirty() && !window.confirm(CONFIRM_MESSAGE)) return;
    onClose();
  }, [onClose, isDirty]);

  // Body scroll lock + ESC handler
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') safeClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [safeClose]);

  // beforeunload — browser-native confirmation for tab close / refresh
  // when there are unsaved edits.
  useEffect(() => {
    const handler = (e) => {
      if (isDirty()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return safeClose;
}
