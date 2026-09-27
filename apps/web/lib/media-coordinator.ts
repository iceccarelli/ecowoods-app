/**
 * media-coordinator — one active player at a time, site-wide.
 *
 * Every FilmStage and AudioStage on a page (the-price-menu alone mounts two
 * films plus an audio track in one section) used to be an independent
 * <video>/<audio> with its own local `playing` state and nothing coordinating
 * between instances — press play on a second chapter while the first was
 * still running, and both played at once. YouTube and Spotify both enforce
 * exactly one active player; this is that rule, generically, for any native
 * HTMLMediaElement on the page.
 *
 * A module-level Set is the right lifetime here: one browser tab runs this
 * module once, the set is empty on every fresh page load, and nothing needs
 * to survive a navigation or be shared across tabs.
 */
const active = new Set<HTMLMediaElement>();

/** Call once an element is mounted (e.g. in a `useEffect`). Returns the
 *  cleanup to run on unmount. Playing this element pauses every other
 *  registered one; nothing here decides whether THIS element autoplays. */
export function registerMediaElement(el: HTMLMediaElement): () => void {
  const onPlay = () => {
    for (const other of active) {
      if (other !== el && !other.paused) other.pause();
    }
  };
  el.addEventListener('play', onPlay);
  active.add(el);
  return () => {
    el.removeEventListener('play', onPlay);
    active.delete(el);
  };
}
