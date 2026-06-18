import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { humanize } from '@/lib/constants';
import { Users, HandCoins, Receipt, CalendarDays, Cake } from 'lucide-react';

export const dynamic = 'force-dynamic';

function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function Stat({ icon: Icon, label, value, href }) {
  const body = (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const monthStart = startOfMonthISO();

  const { data: settings } = await supabase.from('church_settings').select('*').limit(1).maybeSingle();
  const { count: memberCount } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('membership_status', 'active');

  const { data: giving } = await supabase.from('giving').select('amount, type, date, member_name').gte('date', monthStart);
  const { data: expenditures } = await supabase
    .from('expenditures')
    .select('amount, approval_status, date')
    .gte('date', monthStart);
  const { data: events } = await supabase
    .from('events')
    .select('id, title, start_datetime, location')
    .gte('start_datetime', new Date().toISOString())
    .order('start_datetime', { ascending: true })
    .limit(5);

  const givingTotal = (giving || []).reduce((s, g) => s + Number(g.amount || 0), 0);
  const approvedExpenses = (expenditures || [])
    .filter((e) => e.approval_status === 'approved')
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const givingByType = {};
  for (const g of giving || []) givingByType[g.type] = (givingByType[g.type] || 0) + Number(g.amount || 0);

  const recentGiving = [...(giving || [])].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          {settings?.church_name ? `${settings.church_name} Dashboard` : 'Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">This month at a glance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Active members" value={memberCount ?? 0} href="/members" />
        <Stat icon={HandCoins} label="Giving (this month)" value={formatCurrency(givingTotal, settings)} href="/giving" />
        <Stat icon={Receipt} label="Approved expenses" value={formatCurrency(approvedExpenses, settings)} href="/expenditures" />
        <Stat icon={CalendarDays} label="Upcoming events" value={(events || []).length} href="/events" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent>
            <h2 className="mb-3 font-semibold">Giving by type</h2>
            {Object.keys(givingByType).length === 0 ? (
              <p className="text-sm text-muted-foreground">No giving recorded this month yet.</p>
            ) : (
              <ul className="space-y-2">
                {Object.entries(givingByType).map(([type, amount]) => (
                  <li key={type} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{humanize(type)}</span>
                    <span className="font-medium">{formatCurrency(amount, settings)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-3 font-semibold">Upcoming events</h2>
            {(events || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              <ul className="space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 text-sm">
                    <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(e.start_datetime)}
                        {e.location ? ` · ${e.location}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent>
            <h2 className="mb-3 font-semibold">Recent giving</h2>
            {recentGiving.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent giving.</p>
            ) : (
              <div className="divide-y divide-border">
                {recentGiving.map((g, i) => (
                  <div key={i} className="flex items-center justify-between py-2 text-sm">
                    <span>{g.member_name || 'Anonymous'}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-muted-foreground">{humanize(g.type)}</span>
                      <span className="font-medium">{formatCurrency(g.amount, settings)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
