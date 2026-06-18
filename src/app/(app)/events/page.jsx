'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/components/providers';
import { PageHeader, Spinner, EmptyState, Badge } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent } from '@/components/ui/Card';
import { EVENT_TYPES, humanize } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

const EMPTY = {
  title: '', description: '', event_type: 'service',
  start_datetime: '', end_datetime: '', location: '', is_public: false,
};

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export default function EventsPage() {
  const { supabase, role, profile } = useApp();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('upcoming');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canEdit = ['super_admin', 'pastor_admin', 'department_head'].includes(role);
  const canDelete = ['super_admin', 'pastor_admin'].includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from('events')
      .select('*')
      .order('start_datetime', { ascending: false });
    if (e) setError(e.message);
    else setEvents(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  }

  function openEdit(ev) {
    setEditing(ev);
    setForm({
      ...EMPTY,
      ...ev,
      start_datetime: toLocalInput(ev.start_datetime),
      end_datetime: toLocalInput(ev.end_datetime),
      is_public: !!ev.is_public,
    });
    setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = { ...form };
    payload.start_datetime = payload.start_datetime ? new Date(payload.start_datetime).toISOString() : null;
    payload.end_datetime = payload.end_datetime ? new Date(payload.end_datetime).toISOString() : null;
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
    if (!editing) payload.created_by_name = profile?.full_name || null;

    const query = editing
      ? supabase.from('events').update(payload).eq('id', editing.id)
      : supabase.from('events').insert(payload);
    const { error: e2 } = await query;
    setSaving(false);
    if (e2) { setError(e2.message); return; }
    setModalOpen(false);
    load();
  }

  async function remove(ev) {
    if (!confirm(`Delete "${ev.title}"?`)) return;
    const { error: e } = await supabase.from('events').delete().eq('id', ev.id);
    if (e) setError(e.message);
    else load();
  }

  const now = Date.now();
  const filtered = events.filter((ev) => {
    const matchesSearch = (ev.title || '').toLowerCase().includes(search.toLowerCase());
    const t = ev.start_datetime ? new Date(ev.start_datetime).getTime() : 0;
    const matchesTime =
      timeFilter === 'all' ||
      (timeFilter === 'upcoming' && t >= now) ||
      (timeFilter === 'past' && t < now);
    return matchesSearch && matchesTime;
  });

  return (
    <div>
      <PageHeader
        title="Events"
        description="Schedule and manage church events"
        action={canEdit && <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add event</Button>}
      />

      {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by title" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select className="w-44" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
          <option value="all">All</option>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No events found" description="Add your first event to get started." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Start</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Visibility</th>
                    {(canEdit || canDelete) && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((ev) => (
                    <tr key={ev.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{ev.title}</td>
                      <td className="px-4 py-3">{humanize(ev.event_type)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(ev.start_datetime)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{ev.location || '—'}</td>
                      <td className="px-4 py-3">
                        {ev.is_public
                          ? <Badge className="bg-green-100 text-green-700">Public</Badge>
                          : <Badge className="bg-gray-100 text-gray-600">Private</Badge>}
                      </td>
                      {(canEdit || canDelete) && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {canEdit && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ev)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(ev)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
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
        title={editing ? 'Edit event' : 'Add event'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="event-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        <form id="event-form" onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Event type</Label>
              <Select value={form.event_type || ''} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="datetime-local" required value={form.start_datetime || ''} onChange={(e) => setForm({ ...form, start_datetime: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input type="datetime-local" value={form.end_datetime || ''} onChange={(e) => setForm({ ...form, end_datetime: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              checked={!!form.is_public}
              onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
            />
            Public event
          </label>
        </form>
      </Modal>
    </div>
  );
}
