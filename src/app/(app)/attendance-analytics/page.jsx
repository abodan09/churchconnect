'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/components/providers';
import { PageHeader, Spinner } from '@/components/ui/Misc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { humanize } from '@/lib/constants';

export default function AttendanceAnalyticsPage() {
  const { supabase } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: e } = await supabase.from('attendance').select('*');
    if (e) setError(e.message);
    else setRows(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const totalCheckins = rows.length;
  const uniqueMembers = new Set(rows.map((r) => r.member_id).filter(Boolean)).size;

  const byStatus = {};
  rows.forEach((r) => {
    const k = r.status || 'present';
    byStatus[k] = (byStatus[k] || 0) + 1;
  });
  const statusRows = Object.entries(byStatus)
    .map(([k, v]) => ({ key: k, count: v }))
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      <PageHeader title="Attendance Analytics" description="Check-in trends and participation" />

      {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Total check-ins" value={totalCheckins} />
            <StatCard label="Unique members" value={uniqueMembers} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Check-ins by status</CardTitle>
            </CardHeader>
            <CardContent>
              {statusRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendance records yet.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {statusRows.map((r) => (
                    <li key={r.key} className="flex justify-between py-2">
                      <span>{humanize(r.key)}</span>
                      <span className="font-medium">{r.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
