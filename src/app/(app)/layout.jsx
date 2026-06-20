import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Providers } from '@/components/providers';
import { Sidebar } from '@/components/Sidebar';
import { AIAssistant } from '@/components/AIAssistant';

// Server layout for all authenticated pages. Middleware already guarantees a
// session here; this also loads the profile + church settings once and shares
// them with client components via <Providers>.
export default async function AppLayout({ children }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: settings } = await supabase
    .from('church_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  // First-run: an admin with no church settings is sent to the setup wizard.
  const role = profile?.role === 'admin' ? 'super_admin' : profile?.role;
  if (!settings && role === 'super_admin') {
    redirect('/setup');
  }

  return (
    <Providers profile={profile || { id: user.id, email: user.email, role: 'member' }} settings={settings}>
      <div className="flex min-h-screen flex-col bg-muted/40 lg:flex-row">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
        <AIAssistant />
      </div>
    </Providers>
  );
}
