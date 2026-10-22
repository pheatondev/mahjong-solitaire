/* widgets.js — small a11y helpers for overlay widgets (GDD §14.1 view module, §17). */

/* `a[href]` (not `[href]`): SVG `<use href>` candies (e.g. the four sealed tiles in
   the fail card, §3.6) carry href too and would match `[href]` — .focus() on a
   SVGUseElement is a silent no-op and the dialog never received focus (§17). */
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Dialog focus trap (§17: dialogs get role="dialog" + focus trap).
 * Moves focus into the dialog, keeps Tab cycling inside it while it's open,
 * and restores focus to the previously-focused element on release.
 *
 * @param {HTMLElement} dlg — the open dialog element
 * @returns {() => void} release — removes the trap and restores prior focus
 */
export function trapFocus(dlg) {
  const prev = document.activeElement;
  const focusables = () => [...dlg.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled);

  const first = focusables()[0];
  (first || dlg).focus();

  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) {
      e.preventDefault();
      return;
    }
    const firstEl = f[0];
    const lastEl = f[f.length - 1];
    if (e.shiftKey && document.activeElement === firstEl) {
      lastEl.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      firstEl.focus();
      e.preventDefault();
    }
  };

  dlg.addEventListener('keydown', onKey);
  return () => {
    dlg.removeEventListener('keydown', onKey);
    if (prev && typeof prev.focus === 'function') prev.focus();
  };
}
