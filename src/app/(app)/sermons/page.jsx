'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/components/providers';
import { PageHeader, Spinner, EmptyState } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent } from '@/components/ui/Card';
import { humanize } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const EMPTY = {
  title: '', preacher: '', date: '', media_type: 'audio', file_url: '', description: '',
};

export default function SermonsPage() {
  const { supabase, role } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canEdit = ['super_admin', 'pastor_admin', 'department_head'].includes(role);
  const canDelete = ['super_admin', 'pastor_admin'].includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from('sermons')
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
    setForm({ ...EMPTY, ...r, date: r.date || '', media_type: r.media_type || 'audio' });
    setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = { ...form };
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });

    const query = editing
      ? supabase.from('sermons').update(payload).eq('id', editing.id)
      : supabase.from('sermons').insert(payload);
    const { error: e2 } = await query;
    setSaving(false);
    if (e2) { setError(e2.message); return; }
    setModalOpen(false);
    load();
  }

  async function remove(r) {
    if (!confirm(`Delete "${r.title}"?`)) return;
    const { error: e } = await supabase.from('sermons').delete().eq('id', r.id);
    if (e) setError(e.message);
    else load();
  }

  return (
    <div>
      <PageHeader
        title="Sermons"
        description="Recorded messages and teaching archive"
        action={canEdit && <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add sermon</Button>}
      />

      {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : rows.length === 0 ? (
        <EmptyState title="No sermons yet" description="Add your first sermon to get started." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Preacher</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Media</th>
                    {(canEdit || canDelete) && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{r.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.preacher || '—'}</td>
                      <td className="px-4 py-3">{formatDate(r.date) || '—'}</td>
                      <td className="px-4 py-3">{humanize(r.media_type || '—')}</td>
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
        title={editing ? 'Edit sermon' : 'Add sermon'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="sermon-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        <form id="sermon-form" onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Preacher</Label>
              <Input value={form.preacher || ''} onChange={(e) => setForm({ ...form, preacher: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Media type</Label>
            <Select value={form.media_type} onChange={(e) => setForm({ ...form, media_type: e.target.value })}>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>File URL</Label>
            <Input value={form.file_url || ''} onChange={(e) => setForm({ ...form, file_url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
