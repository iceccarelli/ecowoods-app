'use client';

import dynamic from 'next/dynamic';

/**
 * Defers the ChatWidget into its own client chunk so its ~200 lines of JS never
 * block first paint or initial hydration. ssr:false: an interactive chat has no
 * SSR value, and skipping it shrinks the server-rendered HTML too. The launcher
 * still appears right after hydration.
 */
const ChatWidget = dynamic(() => import('./ChatWidget'), { ssr: false });

export default function ChatWidgetLoader() {
  return <ChatWidget />;
}
