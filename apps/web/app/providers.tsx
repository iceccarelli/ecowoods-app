'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { Toaster } from 'sonner';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster 
          position="top-center" 
          richColors 
          closeButton 
          className="font-sans" 
          toastOptions={{
            classNames: {
              toast: 'group toast group-[.toaster]:bg-white group-[.toaster]:text-ink group-[.toaster]:border-line group-[.toaster]:shadow-warm',
              description: 'group-[.toast]:text-muted',
              actionButton: 'group-[.toast]:bg-copper group-[.toast]:text-white',
              cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-white',
            },
          }}
        />
      </QueryClientProvider>
    </SessionProvider>
  );
}
