'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/components/providers';
import { PageHeader, Spinner } from '@/components/ui/Misc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { humanize } from '@/lib/constants';

function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { supabase, fmt } = useApp();
  const [giving, setGiving] = useState([]);
  const [expenditures, setExpenditures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const start = monthStartISO();
    const [g, x] = await Promise.all([
      supabase.from('giving').select('*').gte('date', start),
      supabase.from('expenditures').select('*').gte('date', start),
    ]);
    if (g.error) setError(g.error.message);
    else setGiving(g.data || []);
    if (x.error) setError(x.error.message);
    else setExpenditures(x.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const totalGiving = giving.reduce((s, r) => s + Number(r.amount || 0), 0);
  const approvedExp = expenditures.filter((r) => r.approval_status === 'approved');
  const totalExpenditures = approvedExp.reduce((s, r) => s + Number(r.amount || 0), 0);
  const net = totalGiving - totalExpenditures;

  const givingByType = aggregate(giving, 'type');
  const expByCategory = aggregate(approvedExp, 'category');

  const now = new Date();
  const monthLabel = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div>
      <PageHeader title="Reports" description={`Financial summary for ${monthLabel}`} />

      {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total giving" value={fmt(totalGiving)} className="text-green-600" />
            <StatCard label="Approved expenditures" value={fmt(totalExpenditures)} className="text-red-600" />
            <StatCard label="Net" value={fmt(net)} className={net >= 0 ? 'text-green-600' : 'text-red-600'} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Breakdown title="Giving by type" rows={givingByType} fmt={fmt} empty="No giving this month." />
            <Breakdown title="Expenditures by category" rows={expByCategory} fmt={fmt} empty="No approved expenditures this month." />
          </div>
        </div>
      )}
    </div>
  );
}

function aggregate(rows, key) {
  const map = {};
  rows.forEach((r) => {
    const k = r[key] || 'other';
    map[k] = (map[k] || 0) + Number(r.amount || 0);
  });
  return Object.entries(map)
    .map(([k, v]) => ({ key: k, total: v }))
    .sort((a, b) => b.total - a.total);
}

function StatCard({ label, value, className }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${className}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Breakdown({ title, rows, fmt, empty }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {rows.map((r) => (
              <li key={r.key} className="flex justify-between py-2">
                <span>{humanize(r.key)}</span>
                <span className="font-medium">{fmt(r.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
