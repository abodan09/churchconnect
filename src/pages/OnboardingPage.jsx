import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useAuth } from '@/lib/ClerkAuthContext';
import { Church, Loader2, ArrowRight, CheckCircle } from 'lucide-react';

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export default function OnboardingPage() {
  const { user, signOut } = useAuth();
  const { getToken } = useClerkAuth();
  const navigate = useNavigate();
  const [churchName, setChurchName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleNameChange(val) {
    setChurchName(val);
    if (!slugEdited) setSlug(slugify(val));
  }

  function handleSlugChange(val) {
    setSlug(slugify(val) || val.toLowerCase());
    setSlugEdited(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!churchName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const token = await getToken() || '';
      const res = await fetch('/api/churches/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ church_name: churchName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create church');
      }
      // Reload the page so ClerkAuthContext re-fetches the profile with church_id
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-emerald-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-800 mb-4">
            <Church className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set up your church</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Welcome{user?.first_name ? `, ${user.first_name}` : ''}! Let's create your church workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          {/* Steps indicator */}
          <div className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" /> Account created
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-primary-700 font-semibold">Church setup</span>
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-gray-300">Dashboard</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Church name <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                required
                value={churchName}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="e.g. Grace Chapel, Living Word Church"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-800/20 focus:border-primary-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Church URL slug
              </label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary-800/20 focus-within:border-primary-800">
                <span className="px-3 py-2.5 bg-gray-50 text-gray-400 text-sm border-r border-gray-200 select-none">
                  church.frozenbit.eu/
                </span>
                <input
                  value={slug}
                  onChange={e => handleSlugChange(e.target.value)}
                  placeholder="grace-chapel"
                  className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-transparent"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Unique identifier for your church. Lowercase letters, numbers, and hyphens only.</p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !churchName.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary-800 hover:bg-primary-900 text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating your church…</> : <>Create Church <ArrowRight className="w-4 h-4" /></>}
          </button>

          <button
            type="button"
            onClick={() => signOut('/login')}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600"
          >
            Sign out and use a different account
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Each church is an isolated workspace. Your data is never shared with other churches.
        </p>
      </div>
    </div>
  );
}
