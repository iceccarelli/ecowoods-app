'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ASSISTANT_OPEN_EVENT } from '@/lib/assistant';

/**
 * Defers the ChatWidget into its own client chunk so its ~200 lines of JS never
 * block first paint or initial hydration. ssr:false: an interactive chat has no
 * SSR value, and skipping it shrinks the server-rendered HTML too.
 */
const ChatWidget = dynamic(() => import('./ChatWidget'), { ssr: false });

/**
 * PERFORMANCE PASS — THE CHUNK LOADED THE INSTANT HYDRATION FINISHED, ON
 * EVERY PAGE, WHETHER OR NOT ANYONE WAS GOING TO USE IT.
 *
 * The dynamic import above already keeps the widget out of the MAIN bundle.
 * What it did not do is delay WHEN that separate chunk gets fetched, parsed
 * and executed: `<ChatWidgetLoader />` rendered `<ChatWidget />` unconditionally,
 * so the request for it went out the moment this component mounted — squarely
 * inside the window that decides Total Blocking Time and Interaction to Next
 * Paint, competing with the page's own hydration for the same thread.
 *
 * A homeowner reading the hero has not asked for a chat widget yet. So this
 * waits for the first real signal that they might: genuine interaction
 * (scroll, a pointer move, a key press, a touch), or the browser going idle,
 * whichever comes first — capped at IDLE_TIMEOUT_MS so it never waits forever
 * on a page nobody touches. `requestIdleCallback` is Safari-less, so a
 * `setTimeout` at the same delay is the fallback, not a shorter one — the
 * point is not firing early, not firing exactly on schedule.
 *
 * ONE THING THIS MUST NOT BREAK: OPENING THE ASSISTANT FROM ELSEWHERE BEFORE
 * IT EXISTS.
 *
 * lib/assistant.ts's openAssistant() is called from the configurator, ⌘K and
 * exit-intent, documented there as "safe to call... before ChatWidget mounts" —
 * which was true only because ChatWidget was ALWAYS already mounted by the
 * time anything else on the page could dispatch that event. Once mounting is
 * deferred, a genuine early call would fire into a window with no listener and
 * do nothing. So this also listens for that same event before it is ready,
 * mounts immediately, and re-dispatches the same detail one frame later — by
 * then ChatWidget's own listener (attached on its mount) is there to catch it.
 */
const IDLE_TIMEOUT_MS = 4000;
const ACTIVATE_ON: (keyof WindowEventMap)[] = ['scroll', 'pointermove', 'pointerdown', 'keydown', 'touchstart'];

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export default function ChatWidgetLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    let activated = false;
    const activate = () => {
      if (activated) return;
      activated = true;
      setReady(true);
    };

    const onOpenBeforeReady = (e: Event) => {
      activate();
      const detail = (e as CustomEvent).detail;
      // ChatWidget's own listener attaches on mount, a tick after this state
      // update commits — give it a frame before replaying the request.
      requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_EVENT, { detail }));
      });
    };

    for (const type of ACTIVATE_ON) {
      window.addEventListener(type, activate, { passive: true, once: true });
    }
    window.addEventListener(ASSISTANT_OPEN_EVENT, onOpenBeforeReady, { once: true });

    const w = window as IdleWindow;
    const hasIdleCallback = typeof w.requestIdleCallback === 'function';
    const idleId = hasIdleCallback
      ? w.requestIdleCallback!(activate, { timeout: IDLE_TIMEOUT_MS })
      : window.setTimeout(activate, IDLE_TIMEOUT_MS);

    return () => {
      for (const type of ACTIVATE_ON) window.removeEventListener(type, activate);
      window.removeEventListener(ASSISTANT_OPEN_EVENT, onOpenBeforeReady);
      if (hasIdleCallback) w.cancelIdleCallback?.(idleId as number);
      else window.clearTimeout(idleId as number);
    };
  }, [ready]);

  if (!ready) return null;
  return <ChatWidget />;
}
