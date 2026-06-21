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
          setProfile(profileRows.length ? profileRows[0] : null);
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

  const value = {
    user: user ? {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      first_name: user.firstName,
      last_name: user.lastName,
      full_name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      data: { role: profile?.role || 'member', department_id: profile?.departmentId || memberDeptId },
      role: profile?.role || 'member',
    } : null,
    isAuthenticated: !!isSignedIn,
    isLoadingAuth: !userLoaded || (!!isSignedIn && !profileLoaded),
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
