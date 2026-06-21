import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/ElectronAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export default function LocalSetupPage() {
  const { setup } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' }); return;
    }
    if (form.password.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'destructive' }); return;
    }
    setLoading(true);
    try {
      await setup(form.email, form.password, form.full_name);
      navigate('/');
    } catch (err) {
      toast({ title: 'Setup failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-primary-foreground">✝</span>
          </div>
          <h1 className="text-2xl font-bold">Welcome to ChurchConnect</h1>
          <p className="text-muted-foreground text-sm mt-1">Create your administrator account to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl p-6 space-y-4 shadow-sm">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input placeholder="Pastor John Doe" value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" placeholder="admin@church.org" value={form.email} onChange={e => set('email', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" placeholder="Min. 8 characters" value={form.password} onChange={e => set('password', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm Password</Label>
            <Input type="password" placeholder="Repeat password" value={form.confirm} onChange={e => set('confirm', e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Setting up…' : 'Create Admin Account'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center">
          Your data is stored locally on this device. No internet required.
        </p>
      </div>
    </div>
  );
}
