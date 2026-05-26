import { useState } from 'react';
export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  return { user, login: async (e: string, p: string) => setUser({ id: '1', role: 'customer' }), logout: () => setUser(null), isPro: user?.role === 'pro' };
};
