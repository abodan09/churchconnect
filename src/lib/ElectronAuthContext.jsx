import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ElectronAuthContext = createContext(null);

const API_BASE = window.electronAPI?.apiBase || 'http://localhost:14747';
const TOKEN_KEY = 'churchconnect_local_token';

export function ElectronAuthProvider({ children }) {
  const [localUser, setLocalUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasSetup, setHasSetup] = useState(null); // null = unknown

  // On launch: if this device is already activated, silently issue a fresh
  // local session (never ask again). Otherwise, flag first-run activation.
  useEffect(() => {
    (async () => {
      let hasUsers = false;
      try {
        const s = await fetch(`${API_BASE}/api/auth/status`).then(r => r.json());
        hasUsers = !!s.hasUsers;
        setHasSetup(hasUsers);
      } catch {
        setHasSetup(false);
        setLoading(false);
        return;
      }
      // A failure of the auto-login step must NOT clear hasSetup — the device is
      // still activated; we just fall through to the offline fallback login.
      if (hasUsers) {
        try {
          const r = await fetch(`${API_BASE}/api/auth/session`, { method: 'POST' });
          if (r.ok) {
            const { token, user } = await r.json();
            localStorage.setItem(TOKEN_KEY, token);
            setLocalUser({ ...user, token });
          } else {
            localStorage.removeItem(TOKEN_KEY);
          }
        } catch {
          localStorage.removeItem(TOKEN_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    const { token, user } = await res.json();
    localStorage.setItem(TOKEN_KEY, token);
    setLocalUser({ ...user, token });
    return user;
  }, []);

  const setup = useCallback(async (email, password, full_name) => {
    const res = await fetch(`${API_BASE}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Setup failed');
    }
    const { token, user } = await res.json();
    localStorage.setItem(TOKEN_KEY, token);
    setHasSetup(true);
    setLocalUser({ ...user, token });
    return user;
  }, []);

  // First-launch activation: verify cloud credentials online, then this device
  // is remembered locally and opens offline forever after.
  const cloudSetup = useCallback(async (email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/cloud-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Activation failed');
    }
    const { token, user } = await res.json();
    localStorage.setItem(TOKEN_KEY, token);
    setHasSetup(true);
    setLocalUser({ ...user, token });
    return user;
  }, []);

  const signOut = useCallback((url) => {
    localStorage.removeItem(TOKEN_KEY);
    setLocalUser(null);
    if (url && typeof window !== 'undefined') window.location.href = url;
  }, []);

  // Shape matches ClerkAuthContext so the rest of the app is unchanged
  const value = {
    user: localUser ? {
      id: localUser.id,
      email: localUser.email,
      first_name: (localUser.full_name || '').split(' ')[0] || '',
      last_name: (localUser.full_name || '').split(' ').slice(1).join(' ') || '',
      full_name: localUser.full_name || localUser.email,
      role: localUser.role || 'super_admin',
      data: { role: localUser.role || 'super_admin', department_id: localUser.department_id || null },
    } : null,
    isAuthenticated: !!localUser,
    isLoadingAuth: loading || hasSetup === null,
    isLoadingPublicSettings: false,
    authError: null,
    hasSetup,
    login,
    setup,
    cloudSetup,
    signOut,
    navigateToLogin: () => {},
  };

  return <ElectronAuthContext.Provider value={value}>{children}</ElectronAuthContext.Provider>;
}

export function useAuth() {
  return useContext(ElectronAuthContext);
}
