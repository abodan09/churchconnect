import { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { entities, setAuthToken } from '@/api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, getToken } = useClerkAuth();
  const { signOut, redirectToSignIn } = useClerk();
  const [profile, setProfile] = useState(null);

  // Keep auth token in sync so API calls include a valid Bearer JWT
  useEffect(() => {
    if (isSignedIn) {
      getToken().then(setAuthToken).catch(() => {});
    } else {
      setAuthToken(null);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (user?.id) {
      entities.UserProfile.filter({ clerkId: user.id })
        .then(rows => rows.length ? setProfile(rows[0]) : setProfile(null))
        .catch(() => setProfile(null));
    } else {
      setProfile(null);
    }
  }, [user?.id]);

  const value = {
    user: user ? {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      first_name: user.firstName,
      last_name: user.lastName,
      full_name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      data: { role: profile?.role || 'member', department_id: profile?.departmentId },
      role: profile?.role || 'member',
    } : null,
    isAuthenticated: !!isSignedIn,
    isLoadingAuth: !userLoaded,
    isLoadingPublicSettings: false,
    authError: null,
    navigateToLogin: () => redirectToSignIn(),
    signOut: (url) => signOut({ redirectUrl: url || '/login' }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
