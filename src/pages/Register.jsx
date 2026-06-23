import { useState, useEffect } from 'react';
import { SignUp } from '@clerk/clerk-react';
import { Church, Users } from 'lucide-react';

export default function Register() {
  const [signupType, setSignupType] = useState(
    () => sessionStorage.getItem('cc_signup_type') || 'church'
  );
  const [churchSlug, setChurchSlug] = useState(
    () => sessionStorage.getItem('cc_join_slug') || ''
  );

  // Keep sessionStorage in sync as user types / switches type
  useEffect(() => {
    sessionStorage.setItem('cc_signup_type', signupType);
    if (signupType === 'church') sessionStorage.removeItem('cc_join_slug');
  }, [signupType]);

  useEffect(() => {
    if (churchSlug.trim()) sessionStorage.setItem('cc_join_slug', churchSlug.trim());
  }, [churchSlug]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/40 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-3">

        {/* Toggle card — sits above the Clerk form */}
        <div className="bg-card border border-border rounded-2xl px-5 py-4 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-foreground">I'm signing up as a:</p>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSignupType('church')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                signupType === 'church'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              <Church className="w-4 h-4 flex-shrink-0" />
              Church
            </button>

            <button
              onClick={() => setSignupType('member')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                signupType === 'member'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              Member
            </button>
          </div>

          {signupType === 'member' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Church URL Slug</label>
              <div className="flex items-center border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                <span className="px-2.5 py-2 bg-muted text-muted-foreground text-xs border-r border-border select-none whitespace-nowrap">
                  church.frozenbit.eu/
                </span>
                <input
                  value={churchSlug}
                  onChange={e => setChurchSlug(e.target.value)}
                  placeholder="grace-chapel"
                  className="flex-1 px-2.5 py-2 text-sm focus:outline-none bg-transparent min-w-0"
                />
              </div>
              <p className="text-xs text-muted-foreground">Ask your church admin for this slug.</p>
            </div>
          )}
        </div>

        {/* Clerk sign-up form — unchanged interface */}
        <SignUp
          key={signupType}
          routing="path"
          path="/register"
          forceRedirectUrl={signupType === 'church' ? '/setup' : '/join-church'}
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'rounded-2xl shadow-lg border border-border',
            },
          }}
        />
      </div>
    </div>
  );
}
