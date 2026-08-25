/**
 * lib/keyboard.ts — the guard every global key handler must use.
 *
 * WHAT WENT WRONG, AND IT WAS THE MOST EXPENSIVE BUG ON THIS SITE
 *
 * FloorCatalog and MachineCatalog each registered a `window` keydown listener
 * that did this:
 *
 *     if (e.key === 'ArrowRight') go(1);
 *     else if (e.key === 'ArrowLeft') go(-1);
 *     else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
 *
 * A `window` listener fires no matter what has focus. Both components are
 * mounted on the homepage. The homepage contains the primary lead-capture form.
 *
 * So on the highest-traffic page of a business that sells by getting people to
 * type their name and their project into a form: **the space bar did nothing,
 * and the arrow keys jumped a carousel instead of moving the text cursor.**
 * A customer typing "White oak, main floor, about 600 square feet" got
 * "Whiteoak,mainfloor,about600squarefeet" — if they persevered at all.
 *
 * It was reported as a bug in the chat widget. The chat widget was innocent;
 * its input has no key handling beyond Enter. Every text field on the homepage
 * had it, including the estimate form, and the fix belongs in one place rather
 * than in each of them.
 *
 * THE RULE
 *
 * A key handler attached to `window` or `document` must ignore the event when
 * the person is typing. There is no exception. If a shortcut genuinely needs to
 * fire inside a field — Escape to close, ⌘K to open a palette — handle that key
 * explicitly and let everything else through.
 *
 * `scripts/verify-key-handlers.mjs` fails the build on a global keydown
 * listener that calls preventDefault without consulting this module.
 */

/**
 * Is the event coming from somewhere a person is typing?
 *
 * Checks the event target rather than `document.activeElement`, because inside
 * a shadow root or a portal those can differ, and the target is the one that
 * describes where the keystroke was actually going.
 *
 * `contentEditable` counts. So does a `<select>` — its arrow keys change the
 * selection, and stealing them is the same bug wearing a different hat.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  /* A dialog or a listbox that manages its own keys — a combobox, a command
     palette — announces itself through ARIA. Treat it as typing space. */
  const role = el.getAttribute?.('role');
  if (role === 'textbox' || role === 'combobox' || role === 'searchbox') return true;
  return false;
}

/**
 * Wrap a global key handler so it never steals a keystroke from a text field.
 *
 * Use it for every `window`/`document` keydown listener that is a *shortcut*.
 * Escape is deliberately still delivered: closing a dialog with Escape while
 * focus is in its input is the behaviour people expect, and it does not
 * interfere with typing because Escape types nothing.
 *
 *     useEffect(() => {
 *       const onKey = whenNotTyping((e) => {
 *         if (e.key === ' ') { e.preventDefault(); toggle(); }
 *       });
 *       window.addEventListener('keydown', onKey);
 *       return () => window.removeEventListener('keydown', onKey);
 *     }, []);
 */
export function whenNotTyping(
  handler: (e: KeyboardEvent) => void,
  options: { allowEscape?: boolean } = {},
): (e: KeyboardEvent) => void {
  const { allowEscape = true } = options;
  return (e: KeyboardEvent) => {
    if (isTypingTarget(e.target)) {
      if (!(allowEscape && e.key === 'Escape')) return;
    }
    handler(e);
  };
}
