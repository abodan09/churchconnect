import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { Search, X, ChevronDown, ExternalLink, Users, CheckCircle2, XCircle } from 'lucide-react';

const PLAN_OPTIONS = ['trial', 'starter', 'pro'];
const PLAN_COLOR = {
  trial:   'bg-amber-100 text-amber-700 border-amber-200',
  starter: 'bg-blue-100 text-blue-700 border-blue-200',
  pro:     'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function Badge({ plan }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${PLAN_COLOR[plan] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {plan}
    </span>
  );
}

function StatusDot({ active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${active ? 'text-emerald-600' : 'text-red-500'}`}>
      <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function PlanSelect({ current, onChange, disabled }) {
  return (
    <select
      value={current}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer disabled:opacity-50"
    >
      {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
    </select>
  );
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ churchId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.churches.detail(churchId)
      .then(setDetail)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [churchId]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="font-semibold text-slate-800">Church Details</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="space-y-4">
              {[80, 60, 100, 60].map((w, i) => (
                <div key={i} className={`h-4 bg-slate-100 animate-pulse rounded-md`} style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {detail && !loading && (
            <>
              {/* Header */}
              <div className="flex items-center gap-4">
                {detail.settings?.logo_url ? (
                  <img
                    src={detail.settings.logo_url}
                    alt="logo"
                    className="w-14 h-14 rounded-xl object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <span className="text-indigo-600 text-2xl font-bold">✝</span>
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-slate-800 text-lg leading-tight">
                    {detail.settings?.church_name || detail.church.name}
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5 font-mono">{detail.church.slug}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge plan={detail.church.plan} />
                    <StatusDot active={detail.church.is_active} />
                  </div>
                </div>
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-slate-800">{detail.totalMembers}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Members</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-sm font-semibold text-slate-700 capitalize">{detail.church.plan}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Plan</p>
                </div>
              </div>

              {/* Metadata */}
              <div className="space-y-2 text-sm">
                <Row label="Language" value={detail.settings?.language?.toUpperCase() || '—'} />
                <Row label="Currency" value={detail.settings?.currency_code || '—'} />
                <Row label="Status" value={<StatusDot active={detail.church.is_active} />} />
                <Row label="Onboarded" value={new Date(detail.church.createdAt).toLocaleDateString('en', { dateStyle: 'medium' })} />
              </div>

              {/* Registrant / Pastor contact */}
              {detail.adminUser && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Registered by</h4>
                  <div className="bg-slate-50 rounded-xl p-4 flex items-start gap-3">
                    {detail.adminUser.imageUrl ? (
                      <img src={detail.adminUser.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-600 font-bold text-sm">
                          {detail.adminUser.name?.[0] || '?'}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-slate-800">
                        {detail.adminUser.name || 'Unknown'}
                      </p>
                      {detail.adminUser.email && (
                        <a
                          href={`mailto:${detail.adminUser.email}`}
                          className="block text-xs text-indigo-600 hover:underline truncate"
                        >
                          {detail.adminUser.email}
                        </a>
                      )}
                      {detail.adminUser.phone && (
                        <a
                          href={`tel:${detail.adminUser.phone}`}
                          className="block text-xs text-slate-500 hover:text-slate-700"
                        >
                          {detail.adminUser.phone}
                        </a>
                      )}
                      {detail.adminUser.socialProvider && (
                        <p className="text-xs text-slate-400">
                          via{' '}
                          <span className="capitalize">{detail.adminUser.socialProvider}</span>
                          {detail.adminUser.socialEmail && detail.adminUser.socialEmail !== detail.adminUser.email
                            ? ` · ${detail.adminUser.socialEmail}`
                            : ''}
                        </p>
                      )}
                      {detail.adminUser.registeredAt && (
                        <p className="text-xs text-slate-400">
                          Since {new Date(detail.adminUser.registeredAt).toLocaleDateString('en', { dateStyle: 'medium' })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Recent members */}
              {detail.recentMembers?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    Recent Members ({detail.totalMembers} total)
                  </h4>
                  <ul className="space-y-2">
                    {detail.recentMembers.map(m => (
                      <li key={m.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 font-medium">{m.first_name} {m.last_name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          m.membership_status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>{m.membership_status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 flex-shrink-0">{label}</span>
      <span className="text-slate-700 text-right">{value}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChurchesPage() {
  const [churches, setChurches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [updating, setUpdating] = useState(null); // church id being updated

  const load = useCallback((q = '') => {
    setLoading(true);
    api.churches.list(q)
      .then(setChurches)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
  }, [search, load]);

  async function toggleActive(church) {
    setUpdating(church.id);
    try {
      const updated = await api.churches.update(church.id, { is_active: !church.is_active });
      setChurches(cs => cs.map(c => c.id === church.id ? { ...c, is_active: updated.is_active } : c));
    } catch (e) { alert(`Failed: ${e.message}`); }
    finally { setUpdating(null); }
  }

  async function changePlan(church, plan) {
    if (plan === church.plan) return;
    setUpdating(church.id);
    try {
      const updated = await api.churches.update(church.id, { plan });
      setChurches(cs => cs.map(c => c.id === church.id ? { ...c, plan: updated.plan } : c));
    } catch (e) { alert(`Failed: ${e.message}`); }
    finally { setUpdating(null); }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Churches</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {loading ? 'Loading…' : `${churches.length} church${churches.length !== 1 ? 'es' : ''}`}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 w-56"
          />
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">Error: {error}</p>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Church</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Members</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Joined</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {[200, 60, 80, 80, 90, 120].map((w, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-slate-100 animate-pulse rounded" style={{ width: w }} />
                    </td>
                  ))}
                </tr>
              ))}

              {!loading && churches.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    No churches found.
                  </td>
                </tr>
              )}

              {!loading && churches.map(church => {
                const busy = updating === church.id;
                const displayName = church.settings?.church_name || church.name;
                return (
                  <tr key={church.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {church.settings?.logo_url ? (
                          <img
                            src={church.settings.logo_url}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover border border-slate-100 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-indigo-600 text-sm">✝</span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-slate-800">{displayName}</p>
                          <p className="text-xs text-slate-400 font-mono">{church.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {church.member_count}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <PlanSelect
                        current={church.plan}
                        onChange={plan => changePlan(church, plan)}
                        disabled={busy}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <StatusDot active={church.is_active} />
                    </td>
                    <td className="px-4 py-4 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(church.createdAt).toLocaleDateString('en', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(church)}
                          disabled={busy}
                          title={church.is_active ? 'Deactivate' : 'Activate'}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                            church.is_active
                              ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {busy ? '…' : (church.is_active ? 'Deactivate' : 'Activate')}
                        </button>
                        <button
                          onClick={() => setSelectedId(church.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId && (
        <DetailDrawer churchId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
