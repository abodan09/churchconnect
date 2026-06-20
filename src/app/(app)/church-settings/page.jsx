'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/components/providers';
import { PageHeader, Spinner, EmptyState } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CURRENCIES, LANGUAGES } from '@/lib/constants';

const EMPTY = {
  church_name: '', language: 'en', currency_code: 'EUR', currency_symbol: '€', logo_url: '',
};

export default function ChurchSettingsPage() {
  const { supabase, role, setSettings } = useApp();
  const [row, setRow] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canEdit = role === 'super_admin';

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from('church_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (e) setError(e.message);
    else if (data) {
      setRow(data);
      setForm({
        ...EMPTY,
        ...data,
        language: data.language || 'en',
        currency_code: data.currency_code || 'EUR',
        currency_symbol: data.currency_symbol || '€',
      });
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function onCurrencyChange(code) {
    const c = CURRENCIES.find((x) => x.code === code);
    setForm({ ...form, currency_code: code, currency_symbol: c ? c.symbol : form.currency_symbol });
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    const payload = { ...form };
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });

    const { data, error: e2 } = row
      ? await supabase.from('church_settings').update(payload).eq('id', row.id).select('*').single()
      : await supabase.from('church_settings').insert(payload).select('*').single();
    setSaving(false);
    if (e2) { setError(e2.message); return; }
    setRow(data);
    setSettings(data);
    setSuccess('Settings saved.');
  }

  if (!canEdit) {
    return (
      <div>
        <PageHeader title="Church Settings" />
        <EmptyState title="Access denied" description="Only super admins can edit church settings." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Church Settings" description="Configure your church profile and preferences" />

      {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-100 p-3 text-sm text-green-700">{success}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Church name</Label>
                <Input required value={form.church_name || ''} onChange={(e) => setForm({ ...form, church_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Language</Label>
                  <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                    {LANGUAGES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={form.currency_code} onChange={(e) => onCurrencyChange(e.target.value)}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Logo URL</Label>
                <Input value={form.logo_url || ''} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://…" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
