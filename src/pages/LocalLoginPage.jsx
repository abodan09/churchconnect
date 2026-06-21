import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/ElectronAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export default function LocalLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      toast({ title: 'Login failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-primary-foreground">✝</span>
          </div>
          <h1 className="text-2xl font-bold">ChurchConnect</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to your local account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl p-6 space-y-4 shadow-sm">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" placeholder="admin@church.org" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center">
          Running in local (offline) mode — all data is stored on this device.
        </p>
      </div>
    </div>
  );
}
