'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Field';
import { CURRENCIES, LANGUAGES } from '@/lib/constants';

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    church_name: '', language: 'en', currency_code: 'EUR', currency_symbol: '€',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function onCurrencyChange(code) {
    const c = CURRENCIES.find((x) => x.code === code);
    setForm({ ...form, currency_code: code, currency_symbol: c ? c.symbol : form.currency_symbol });
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError('You must be signed in to set up the church.');
      return;
    }

    const payload = { ...form };
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });

    const { error: e2 } = await supabase.from('church_settings').insert(payload);
    setSaving(false);
    if (e2) { setError(e2.message); return; }

    router.replace('/');
    router.refresh();
  }

  return (
    <AuthShell title="Welcome to ChurchConnect" subtitle="Let's set up your church to get started">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <div className="space-y-1.5">
          <Label>Church name</Label>
          <Input required value={form.church_name} onChange={(e) => setForm({ ...form, church_name: e.target.value })} />
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
        <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Setting up…' : 'Finish setup'}</Button>
      </form>
    </AuthShell>
  );
}
