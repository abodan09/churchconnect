import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/ElectronAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Cloud, WifiOff, Loader2 } from 'lucide-react';

export default function LocalSetupPage() {
  const { cloudSetup } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await cloudSetup(form.email.trim(), form.password);
      navigate('/');
    } catch (err) {
      toast({ title: 'Could not activate', description: err.message, variant: 'destructive' });
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
          <h1 className="text-2xl font-bold">Activate this device</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sign in with your ChurchConnect account to set up the offline app.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl p-6 space-y-4 shadow-sm">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" autoFocus placeholder="you@church.org" value={form.email} onChange={e => set('email', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" placeholder="Your ChurchConnect password" value={form.password} onChange={e => set('password', e.target.value)} required />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : <><Cloud className="w-4 h-4" /> Activate</>}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Don’t have an account yet? Create one at church.frozenbit.eu, then sign in here.
          </p>
        </form>

        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
          <WifiOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            Internet is needed <span className="font-medium text-foreground">only for this one-time activation</span>.
            After that, the app opens straight to your dashboard and works fully offline — you won’t be asked to sign in again on this device.
          </p>
        </div>
      </div>
    </div>
  );
}
