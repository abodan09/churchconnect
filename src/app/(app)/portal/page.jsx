'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/components/providers';
import { PageHeader, Spinner, EmptyState, Badge } from '@/components/ui/Misc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { humanize } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

export default function PortalPage() {
  const { supabase, profile, fmt } = useApp();
  const [member, setMember] = useState(null);
  const [giving, setGiving] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data: m, error: me } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();
    if (me) { setError(me.message); setLoading(false); return; }
    setMember(m);

    if (m) {
      const { data: g, error: ge } = await supabase
        .from('giving')
        .select('*')
        .eq('member_id', m.id)
        .order('date', { ascending: false });
      if (ge) setError(ge.message);
      else setGiving(g || []);
    }

    const { data: ev, error: ee } = await supabase
      .from('events')
      .select('*')
      .eq('is_public', true)
      .gte('start_datetime', new Date().toISOString())
      .order('start_datetime', { ascending: true })
      .limit(5);
    if (ee) setError(ee.message);
    else setEvents(ev || []);

    setLoading(false);
  }, [supabase, profile.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div>
        <PageHeader title="My Portal" />
        <div className="flex justify-center py-16"><Spinner /></div>
      </div>
    );
  }

  if (!member) {
    return (
      <div>
        <PageHeader title="My Portal" />
        {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <EmptyState
          title="No member profile linked"
          description="Your account isn't linked to a member profile yet. Please contact a church administrator."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My Portal" description="Your profile, giving and upcoming events" />

      {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Name" value={`${member.first_name || ''} ${member.last_name || ''}`.trim() || '—'} />
            <Row label="Email" value={member.email || '—'} />
            <Row label="Phone" value={member.phone || '—'} />
            <Row label="Address" value={member.address || '—'} />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge className="bg-green-100 text-green-700">{humanize(member.membership_status || 'active')}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming events</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming public events.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {events.map((ev) => (
                  <li key={ev.id} className="flex flex-col">
                    <span className="font-medium">{ev.title || ev.name || 'Event'}</span>
                    <span className="text-muted-foreground">{formatDate(ev.start_datetime)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>My giving</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {giving.length === 0 ? (
            <div className="p-5">
              <p className="text-sm text-muted-foreground">No giving records yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {giving.map((g) => (
                    <tr key={g.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">{formatDate(g.date) || '—'}</td>
                      <td className="px-4 py-3">{humanize(g.type) || '—'}</td>
                      <td className="px-4 py-3 font-medium">{fmt(g.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
