import { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { entities, setAuthToken } from '@/api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, getToken } = useClerkAuth();
  const { signOut, redirectToSignIn } = useClerk();
  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Keep auth token in sync so API calls include a valid Bearer JWT
  useEffect(() => {
    if (isSignedIn) {
      getToken().then(setAuthToken).catch(() => {});
    } else {
      setAuthToken(null);
    }
  }, [isSignedIn]);

  const [memberDeptId, setMemberDeptId] = useState(null);

  useEffect(() => {
    if (user?.id) {
      setProfileLoaded(false);
      const email = user.primaryEmailAddress?.emailAddress;
      Promise.all([
        entities.UserProfile.filter({ clerkId: user.id }),
        email ? entities.Member.filter({ email }) : Promise.resolve([]),
      ])
        .then(([profileRows, memberRows]) => {
          const prof = profileRows.length ? profileRows[0] : null;
          setProfile(prof);
          setMemberDeptId(memberRows[0]?.department_id || null);
          setProfileLoaded(true);
        })
        .catch(() => {
          setProfile(null);
          setMemberDeptId(null);
          setProfileLoaded(true);
        });
    } else {
      setProfile(null);
      setMemberDeptId(null);
      setProfileLoaded(!isSignedIn);
    }
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
