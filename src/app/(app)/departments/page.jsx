'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/components/providers';
import { PageHeader, Spinner, EmptyState, Badge } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent } from '@/components/ui/Card';
import { humanize } from '@/lib/constants';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const EMPTY = {
  name: '', description: '', head_name: '', allowed_media_types: 'none',
  media_upload_enabled: false, is_active: true, color: '#4f46e5',
};

export default function DepartmentsPage() {
  const { supabase, role } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canEdit = role === 'super_admin';
  const canDelete = role === 'super_admin';

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from('departments')
      .select('*')
      .order('name', { ascending: true });
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
      allowed_media_types: r.allowed_media_types || 'none',
      media_upload_enabled: !!r.media_upload_enabled,
      is_active: r.is_active !== false,
      color: r.color || '#4f46e5',
    });
    setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = { ...form };
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });

    const query = editing
      ? supabase.from('departments').update(payload).eq('id', editing.id)
      : supabase.from('departments').insert(payload);
    const { error: e2 } = await query;
    setSaving(false);
    if (e2) { setError(e2.message); return; }
    setModalOpen(false);
    load();
  }

  async function remove(r) {
    if (!confirm(`Delete ${r.name}?`)) return;
    const { error: e } = await supabase.from('departments').delete().eq('id', r.id);
    if (e) setError(e.message);
    else load();
  }

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Ministries and teams in your church"
        action={canEdit && <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add department</Button>}
      />

      {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : rows.length === 0 ? (
        <EmptyState title="No departments yet" description="Add your first department to get started." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Head</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Media</th>
                    {(canEdit || canDelete) && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: r.color || '#4f46e5' }} />
                          {r.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.head_name || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge className={r.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                          {r.is_active !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{humanize(r.allowed_media_types || 'none')}</td>
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
        title={editing ? 'Edit department' : 'Add department'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="department-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        <form id="department-form" onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Head name</Label>
              <Input value={form.head_name || ''} onChange={(e) => setForm({ ...form, head_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Allowed media types</Label>
              <Select value={form.allowed_media_types} onChange={(e) => setForm({ ...form, allowed_media_types: e.target.value })}>
                <option value="none">None</option>
                <option value="audio">Audio</option>
                <option value="video">Video</option>
                <option value="both">Both</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <Input type="color" className="h-10 w-20 p-1" value={form.color || '#4f46e5'} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={!!form.media_upload_enabled} onChange={(e) => setForm({ ...form, media_upload_enabled: e.target.checked })} />
            Media upload enabled
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active
          </label>
        </form>
      </Modal>
    </div>
  );
}
