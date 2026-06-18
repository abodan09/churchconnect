'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/components/providers';
import { PageHeader, Spinner, EmptyState, Badge } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent } from '@/components/ui/Card';
import { EXPENDITURE_CATEGORIES, humanize } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';

const EMPTY = {
  date: '', category: 'other', description: '', amount: '', notes: '',
};

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function ExpendituresPage() {
  const { supabase, role, profile, fmt } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canEdit = ['super_admin', 'pastor_admin', 'finance_officer', 'department_head'].includes(role);
  const canApprove = ['super_admin', 'pastor_admin', 'finance_officer'].includes(role);
  const canDelete = ['super_admin', 'pastor_admin'].includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from('expenditures')
      .select('*')
      .order('date', { ascending: false });
    if (e) setError(e.message);
    else setRows(data || []);
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
    payload.amount = payload.amount === '' ? null : Number(payload.amount);
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });

    const query = editing
      ? supabase.from('expenditures').update(payload).eq('id', editing.id)
      : supabase.from('expenditures').insert(payload);
    const { error: e2 } = await query;
    setSaving(false);
    if (e2) { setError(e2.message); return; }
    setModalOpen(false);
    load();
  }

  async function setStatus(r, approval_status) {
    setError('');
    const { error: e } = await supabase
      .from('expenditures')
      .update({ approval_status, approved_by: profile.id, approved_date: new Date().toISOString() })
      .eq('id', r.id);
    if (e) setError(e.message);
    else load();
  }

  async function remove(r) {
    if (!confirm(`Delete this expenditure (${r.description || humanize(r.category)})?`)) return;
    const { error: e } = await supabase.from('expenditures').delete().eq('id', r.id);
    if (e) setError(e.message);
    else load();
  }

  return (
    <div>
      <PageHeader
        title="Expenditures"
        description="Track and approve church spending"
        action={canEdit && <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add expenditure</Button>}
      />

      {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : rows.length === 0 ? (
        <EmptyState title="No expenditures yet" description="Record your first expenditure to get started." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    {(canEdit || canApprove || canDelete) && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">{formatDate(r.date) || '—'}</td>
                      <td className="px-4 py-3">{humanize(r.category)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.description || '—'}</td>
                      <td className="px-4 py-3 font-medium">{fmt(r.amount)}</td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_STYLES[r.approval_status] || STATUS_STYLES.pending}>
                          {humanize(r.approval_status || 'pending')}
                        </Badge>
                      </td>
                      {(canEdit || canApprove || canDelete) && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {canApprove && r.approval_status !== 'approved' && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => setStatus(r, 'approved')} aria-label="Approve">
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            {canApprove && r.approval_status !== 'rejected' && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setStatus(r, 'rejected')} aria-label="Reject">
                                <X className="h-4 w-4" />
                              </Button>
                            )}
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
        title={editing ? 'Edit expenditure' : 'Add expenditure'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="expenditure-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        <form id="expenditure-form" onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" required value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {EXPENDITURE_CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
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
