'use client';

import { createContext, useContext, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';

const AppContext = createContext(null);

// Holds the signed-in user's profile + church settings for client components.
export function Providers({ profile, settings: initialSettings, children }) {
  const [settings, setSettings] = useState(initialSettings);
  const supabase = createClient();

  const role = profile?.role === 'admin' ? 'super_admin' : profile?.role || 'member';

  const value = {
    supabase,
    profile,
    role,
    settings,
    setSettings,
    fmt: (n) => formatCurrency(n, settings),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <Providers>');
  return ctx;
}
