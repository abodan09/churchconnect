import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Building2, Users, CheckCircle, XCircle } from 'lucide-react';

const PLAN_COLOR = { trial: 'bg-amber-100 text-amber-700', starter: 'bg-blue-100 text-blue-700', pro: 'bg-emerald-100 text-emerald-700' };

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value ?? '—'}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-2 h-36">
      {data.map(({ label, count }) => (
        <div key={label} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs font-medium text-slate-600">{count || ''}</span>
          <div
            className="w-full rounded-t-md bg-indigo-500 transition-all"
            style={{ height: `${Math.max((count / max) * 100, count > 0 ? 4 : 0)}%`, minHeight: count > 0 ? '4px' : '0' }}
          />
          <span className="text-xs text-slate-400 whitespace-nowrap">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.stats().then(setStats).catch(e => setError(e.message));
  }, []);

  if (error) {
    return <p className="text-red-500 text-sm">Failed to load stats: {error}</p>;
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Platform overview — all churches</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Churches" value={stats?.totalChurches} color="bg-indigo-100 text-indigo-600" />
        <StatCard icon={CheckCircle} label="Active" value={stats?.activeChurches} color="bg-emerald-100 text-emerald-600" />
        <StatCard icon={XCircle} label="Inactive" value={stats?.inactiveChurches} color="bg-red-100 text-red-500" />
        <StatCard icon={Users} label="Total Members" value={stats?.totalMembers} color="bg-violet-100 text-violet-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-700 mb-5">Churches by Plan</h2>
          {stats ? (
            <div className="space-y-3">
              {['trial', 'starter', 'pro'].map(plan => {
                const count = stats.plans.find(p => p.plan === plan)?.count || 0;
                const pct = stats.totalChurches ? Math.round((count / stats.totalChurches) * 100) : 0;
                return (
                  <div key={plan}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className={`capitalize px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLOR[plan] || 'bg-slate-100 text-slate-600'}`}>{plan}</span>
                      <span className="text-slate-500 font-medium">{count} <span className="text-slate-400">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-28 bg-slate-50 animate-pulse rounded-lg" />
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-700 mb-5">New Churches — Last 6 Months</h2>
          {stats ? (
            <BarChart data={stats.monthlyGrowth} />
          ) : (
            <div className="h-36 bg-slate-50 animate-pulse rounded-lg" />
          )}
        </div>
      </div>
    </div>
  );
}
