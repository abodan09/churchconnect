'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/components/providers';
import { PageHeader, Spinner, EmptyState, Badge } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent } from '@/components/ui/Card';
import { PROPERTY_TYPES, PROPERTY_CONDITIONS, humanize } from '@/lib/constants';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const EMPTY = {
  name: '', type: 'building', description: '', location_or_serial: '',
  purchase_date: '', purchase_value: '', current_condition: 'good', maintenance_notes: '',
};

const CONDITION_STYLES = {
  excellent: 'bg-green-100 text-green-700',
  good: 'bg-emerald-100 text-emerald-700',
  fair: 'bg-amber-100 text-amber-700',
  poor: 'bg-orange-100 text-orange-700',
  decommissioned: 'bg-gray-100 text-gray-600',
};

export default function PropertiesPage() {
  const { supabase, role, fmt } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canEdit = ['super_admin', 'pastor_admin', 'finance_officer'].includes(role);
  const canDelete = ['super_admin', 'pastor_admin'].includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });
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
    setForm({
      ...EMPTY,
      ...r,
      purchase_date: r.purchase_date || '',
      purchase_value: r.purchase_value ?? '',
    });
    setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = { ...form };
    payload.purchase_value = payload.purchase_value === '' ? null : Number(payload.purchase_value);
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });

    const query = editing
      ? supabase.from('properties').update(payload).eq('id', editing.id)
      : supabase.from('properties').insert(payload);
    const { error: e2 } = await query;
    setSaving(false);
    if (e2) { setError(e2.message); return; }
    setModalOpen(false);
    load();
  }

  async function remove(r) {
    if (!confirm(`Delete ${r.name}?`)) return;
    const { error: e } = await supabase.from('properties').delete().eq('id', r.id);
    if (e) setError(e.message);
    else load();
  }

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Church assets and equipment register"
        action={canEdit && <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add property</Button>}
      />

      {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : rows.length === 0 ? (
        <EmptyState title="No properties yet" description="Add your first asset to get started." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Condition</th>
                    <th className="px-4 py-3 font-medium">Value</th>
                    {(canEdit || canDelete) && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3">{humanize(r.type)}</td>
                      <td className="px-4 py-3">
                        <Badge className={CONDITION_STYLES[r.current_condition] || 'bg-gray-100 text-gray-600'}>
                          {humanize(r.current_condition || '—')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium">{fmt(r.purchase_value)}</td>
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
        title={editing ? 'Edit property' : 'Add property'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="property-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        <form id="property-form" onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select value={form.current_condition} onChange={(e) => setForm({ ...form, current_condition: e.target.value })}>
                {PROPERTY_CONDITIONS.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Location / serial number</Label>
            <Input value={form.location_or_serial || ''} onChange={(e) => setForm({ ...form, location_or_serial: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Purchase date</Label>
              <Input type="date" value={form.purchase_date || ''} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Purchase value</Label>
              <Input type="number" step="0.01" value={form.purchase_value} onChange={(e) => setForm({ ...form, purchase_value: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Maintenance notes</Label>
            <Textarea value={form.maintenance_notes || ''} onChange={(e) => setForm({ ...form, maintenance_notes: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
