'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/components/providers';
import { PageHeader, Spinner, EmptyState, Badge } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent } from '@/components/ui/Card';
import { ATTENDANCE_STATUS, humanize } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';

const STATUS_STYLES = {
  present: 'bg-green-100 text-green-700',
  late: 'bg-amber-100 text-amber-700',
  excused: 'bg-gray-100 text-gray-600',
};

export default function AttendancePage() {
  const { supabase, role, profile } = useApp();
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [eventId, setEventId] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ member_id: '', status: 'present' });
  const [saving, setSaving] = useState(false);

  const canEdit = ['super_admin', 'pastor_admin', 'data_entry_staff', 'department_head'].includes(role);
  const canDelete = ['super_admin', 'pastor_admin'].includes(role);

  const event = events.find((ev) => ev.id === eventId);

  const loadBase = useCallback(async () => {
    setLoading(true);
    const [{ data: evs, error: e1 }, { data: mems, error: e2 }] = await Promise.all([
      supabase.from('events').select('*').order('start_datetime', { ascending: false }),
      supabase.from('members').select('*').order('first_name', { ascending: true }),
    ]);
    if (e1) setError(e1.message);
    else setEvents(evs || []);
    if (e2) setError(e2.message);
    else setMembers(mems || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadBase(); }, [loadBase]);

  const loadRows = useCallback(async () => {
    if (!eventId) { setRows([]); return; }
    setLoadingRows(true);
    const { data, error: e } = await supabase
      .from('attendance')
      .select('*')
      .eq('event_id', eventId);
    if (e) setError(e.message);
    else setRows(data || []);
    setLoadingRows(false);
  }, [supabase, eventId]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const checkedInIds = new Set(rows.map((r) => r.member_id));
  const availableMembers = members.filter((m) => !checkedInIds.has(m.id));

  function openCheckIn() {
    setForm({ member_id: '', status: 'present' });
    setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    if (!event) return;
    setSaving(true);
    setError('');
    const member = members.find((m) => m.id === form.member_id);
    const payload = {
      event_id: event.id,
      event_name: event.title,
      event_date: event.start_datetime ? event.start_datetime.slice(0, 10) : null,
      member_id: form.member_id || null,
      member_name: member ? `${member.first_name} ${member.last_name}` : null,
      status: form.status,
      checked_in_by: profile?.id || null,
      check_in_time: new Date().toISOString(),
    };
    const { error: e2 } = await supabase.from('attendance').insert(payload);
    setSaving(false);
    if (e2) { setError(e2.message); return; }
    setModalOpen(false);
    loadRows();
  }

  async function remove(r) {
    if (!confirm(`Remove ${r.member_name} from this event?`)) return;
    const { error: e } = await supabase.from('attendance').delete().eq('id', r.id);
    if (e) setError(e.message);
    else loadRows();
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Check members in to events"
        action={canEdit && event && (
          <Button onClick={openCheckIn}><Plus className="h-4 w-4" /> Check in member</Button>
        )}
      />

      {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="mb-4 max-w-md space-y-1.5">
        <Label>Event</Label>
        <Select value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={loading}>
          <option value="">Select an event…</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title} — {formatDate(ev.start_datetime)}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !event ? (
        <EmptyState title="No event selected" description="Choose an event above to view and record attendance." />
      ) : loadingRows ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : rows.length === 0 ? (
        <EmptyState title="No check-ins yet" description="Check in your first member for this event." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Checked in</th>
                    {canDelete && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{r.member_name || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_STYLES[r.status]}>{humanize(r.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.check_in_time)}</td>
                      {canDelete && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(r)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Check in member"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="checkin-form" disabled={saving || !form.member_id}>{saving ? 'Saving…' : 'Check in'}</Button>
          </>
        }
      >
        <form id="checkin-form" onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Member</Label>
            {availableMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">All members have already been checked in for this event.</p>
            ) : (
              <Select required value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}>
                <option value="">Select a member…</option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {ATTENDANCE_STATUS.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </Select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
