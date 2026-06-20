'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/components/providers';
import { PageHeader, Spinner, EmptyState } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent } from '@/components/ui/Card';
import { GIVING_TYPES, PAYMENT_METHODS, humanize } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

const EMPTY = {
  member_name: '', date: '', amount: '', type: 'tithe',
  payment_method: 'cash', service_or_event: '', notes: '',
};

export default function GivingPage() {
  const { supabase, role, fmt } = useApp();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canEdit = ['super_admin', 'pastor_admin', 'finance_officer', 'data_entry_staff'].includes(role);
  const canDelete = ['super_admin', 'finance_officer'].includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from('giving')
      .select('*')
      .order('date', { ascending: false });
    if (e) setError(e.message);
    else setRecords(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  }

  function openEdit(r) {
    setEditing(r);
    setForm({ ...EMPTY, ...r, date: r.date || '', amount: r.amount ?? '' });
    setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = { ...form };
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
    if (payload.amount != null) payload.amount = Number(payload.amount);

    const query = editing
      ? supabase.from('giving').update(payload).eq('id', editing.id)
      : supabase.from('giving').insert(payload);
    const { error: e2 } = await query;
    setSaving(false);
    if (e2) { setError(e2.message); return; }
    setModalOpen(false);
    load();
  }

  async function remove(r) {
    if (!confirm(`Delete this giving record of ${fmt(r.amount)}?`)) return;
    const { error: e } = await supabase.from('giving').delete().eq('id', r.id);
    if (e) setError(e.message);
    else load();
  }

  const filtered = records.filter((r) => {
    const matchesSearch = (r.member_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = !typeFilter || r.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const total = filtered.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const byType = GIVING_TYPES.map((t) => ({
    type: t,
    amount: filtered.filter((r) => r.type === t).reduce((sum, r) => sum + Number(r.amount || 0), 0),
  })).filter((b) => b.amount > 0);

  return (
    <div>
      <PageHeader
        title="Giving"
        description="Record and track contributions"
        action={canEdit && <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add giving</Button>}
      />

      {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-bold">{fmt(total)}</p>
          </CardContent>
        </Card>
        {byType.map((b) => (
          <Card key={b.type}>
            <CardContent>
              <p className="text-sm text-muted-foreground">{humanize(b.type)}</p>
              <p className="mt-1 text-2xl font-bold">{fmt(b.amount)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by member name" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select className="w-44" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {GIVING_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No giving records found" description="Add your first contribution to get started." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                    {(canEdit || canDelete) && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.date)}</td>
                      <td className="px-4 py-3 font-medium">{r.member_name || '—'}</td>
                      <td className="px-4 py-3">{humanize(r.type)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{humanize(r.payment_method) || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmt(r.amount)}</td>
                      {(canEdit || canDelete) && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {canEdit && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(r)}>
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
        title={editing ? 'Edit giving' : 'Add giving'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="giving-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        <form id="giving-form" onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Member name</Label>
            <Input value={form.member_name || ''} onChange={(e) => setForm({ ...form, member_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" required value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {GIVING_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Payment method</Label>
              <Select value={form.payment_method || ''} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Service or event</Label>
            <Input value={form.service_or_event || ''} onChange={(e) => setForm({ ...form, service_or_event: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
