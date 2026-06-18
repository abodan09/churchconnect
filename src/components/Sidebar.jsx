'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as Icons from 'lucide-react';
import { navForRole, ROLE_LABELS } from '@/lib/constants';
import { useApp } from '@/components/providers';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, role, settings, supabase } = useApp();
  const [open, setOpen] = useState(false);

  const items = navForRole(role);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <span className="font-semibold">{settings?.church_name || 'ChurchConnect'}</span>
        <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          <Icons.Menu className="h-5 w-5" />
        </Button>
      </div>

      {open && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-primary text-primary-foreground transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          {settings?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
              <Icons.Church className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{settings?.church_name || 'ChurchConnect'}</p>
            <p className="text-xs text-primary-foreground/70">Management</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const Icon = Icons[item.icon] || Icons.Circle;
            const active = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-white/20' : 'text-primary-foreground/85 hover:bg-white/10',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium">{profile?.full_name || profile?.email}</p>
            <p className="text-xs text-primary-foreground/70">{ROLE_LABELS[role] || role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-primary-foreground/85 transition-colors hover:bg-white/10"
          >
            <Icons.LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
