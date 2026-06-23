import { useState, useEffect } from 'react';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useAuth } from '@/lib/ClerkAuthContext';
import { Church, CheckCircle2, Loader2, AlertCircle, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function JoinChurchPage() {
  const { user, signOut } = useAuth();
  const { getToken } = useClerkAuth();

  const [slug, setSlug] = useState('');
  const [church, setChurch] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem('cc_join_slug');
    if (saved) {
      setSlug(saved);
      lookupChurch(saved);
    }
  }, []);

  async function lookupChurch(slugToLookup) {
    setLookingUp(true);
    setLookupError('');
    setChurch(null);
    try {
      const res = await fetch(`/api/churches/register?slug=${encodeURIComponent(slugToLookup.trim())}`);
      const data = await res.json();
      if (!res.ok) { setLookupError(data.error || 'Church not found.'); return; }
      setChurch(data);
    } catch {
      setLookupError('Network error. Please try again.');
    } finally {
      setLookingUp(false);
    }
  }

  function handleSlugLookup(e) {
    e.preventDefault();
    if (!slug.trim()) return;
    lookupChurch(slug);
  }

  async function handleRequestJoin() {
    setStatus('submitting');
    setSubmitError('');
    try {
      const token = await getToken();
      const res = await fetch('/api/member-join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          church_slug: slug.trim(),
          name: user?.full_name || '',
          email: user?.email || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || 'Failed to submit request.'); setStatus('error'); return; }
      sessionStorage.removeItem('cc_join_slug');
      sessionStorage.removeItem('cc_signup_type');
      setStatus('success');
    } catch {
      setSubmitError('Network error. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary/40 to-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">Request Sent!</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your request to join <span className="font-semibold text-foreground">{church?.name}</span> has been submitted.
            The church administrator will review it and you'll be notified once approved.
          </p>
          <p className="text-xs text-muted-foreground">
            Once approved, sign back in to access your member portal.
          </p>
          <button
            onClick={() => signOut('/login')}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/40 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Church className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Join your church</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Enter your church's URL slug to send a membership request.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg space-y-5">
          {/* Slug lookup */}
          <form onSubmit={handleSlugLookup} className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Church URL Slug</label>
            <div className="flex gap-2">
              <div className="flex flex-1 items-center border border-border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                <span className="px-3 py-2.5 bg-muted text-muted-foreground text-xs border-r border-border select-none whitespace-nowrap">
                  church.frozenbit.eu/
                </span>
                <input
                  value={slug}
                  onChange={e => { setSlug(e.target.value); setChurch(null); setLookupError(''); }}
                  placeholder="grace-chapel"
                  className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-transparent min-w-0"
                />
              </div>
              <button
                type="submit"
                disabled={lookingUp || !slug.trim()}
                className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Look up'}
              </button>
            </div>
          </form>

          {lookupError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{lookupError}</span>
            </div>
          )}

          {/* Church found — show confirmation */}
          {church && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Church className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{church.name}</p>
                  <p className="text-xs text-muted-foreground">{church.slug}</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Requesting as: <span className="font-medium text-foreground">{user?.full_name || user?.email}</span>
              </p>

              {submitError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <button
                onClick={handleRequestJoin}
                disabled={status === 'submitting'}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {status === 'submitting' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending request…</>
                ) : 'Request to Join'}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
            <Link to="/login" className="hover:text-foreground transition-colors">← Back to login</Link>
            <button
              onClick={() => signOut('/login')}
              className="hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
