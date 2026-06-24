import { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { entities, setAuthToken, setTokenGetter } from '@/api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, getToken } = useClerkAuth();
  const { signOut, redirectToSignIn, setActive } = useClerk();
  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Keep auth token in sync so API calls include a valid Bearer JWT
  useEffect(() => {
    if (isSignedIn) {
      setTokenGetter(getToken);
      getToken().then(setAuthToken).catch(() => {});
    } else {
      setTokenGetter(null);
      setAuthToken(null);
    }
  }, [isSignedIn]);

  const [memberDeptId, setMemberDeptId] = useState(null);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      setMemberDeptId(null);
      setProfileLoaded(!isSignedIn);
      return;
    }
    setProfileLoaded(false);
    const email = user.primaryEmailAddress?.emailAddress;
    let cancelled = false;
    getToken()
      .then(token => fetch('/api/me', {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      }))
      .then(r => r.json())
      .then(prof => {
        if (cancelled) return;
        console.log('[auth] /api/me response:', prof);
        setProfile(prof || null);
        setProfileLoaded(true);
        // Activate the church's Clerk Organization so has() checks work against
        // the org's active subscription (required for B2B billing).
        if (prof?.clerkOrgId) {
          setActive({ organization: prof.clerkOrgId }).catch(() => {});
        }
      })
      .catch((err) => {
        console.error('[auth] /api/me failed:', err);
        if (!cancelled) { setProfile(null); setProfileLoaded(true); }
      });
    if (email) {
      entities.Member.filter({ email })
        .then(rows => { if (!cancelled) setMemberDeptId(rows[0]?.department_id || null); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [user?.id]);

  const churchId = profile?.church_id ?? null;

  const value = {
    user: user ? {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      first_name: user.firstName,
      last_name: user.lastName,
      full_name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      data: { role: profile?.role || 'member', department_id: profile?.departmentId || memberDeptId, church_id: churchId },
      role: profile?.role || 'member',
    } : null,
    church_id: churchId,
    // True when a signed-in user has no church yet → needs onboarding
    needsOnboarding: !!isSignedIn && profileLoaded && !churchId,
    isAuthenticated: !!isSignedIn,
    isLoadingAuth: !userLoaded || (!!isSignedIn && !profileLoaded),
    isLoadingPublicSettings: false,
    authError: null,
    navigateToLogin: () => redirectToSignIn(),
    signOut: (url) => signOut({ redirectUrl: url || '/login' }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };

export function useAuth() {
  return useContext(AuthContext);
}
