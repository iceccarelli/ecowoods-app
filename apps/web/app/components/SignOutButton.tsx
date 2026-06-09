'use client';

import { signOut } from 'next-auth/react';

interface SignOutButtonProps {
  className?: string;
}

export default function SignOutButton({ className }: SignOutButtonProps) {
  return (
    <button
      type="button"
      className={className ?? 'portal-signout'}
      onClick={() => signOut({ callbackUrl: '/' })}
    >
      Sign out
    </button>
  );
}
