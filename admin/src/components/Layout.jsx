import { Link, useLocation } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
import { LayoutDashboard, Building2, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

const NAV = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Churches', path: '/churches', icon: Building2 },
];

export default function Layout({ children }) {
  const location = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {open && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-60 flex flex-col bg-slate-950
        transform transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">✝</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">ChurchConnect</p>
            <p className="text-slate-500 text-xs">Admin Console</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ label, path, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          {user && (
            <div className="px-3 mb-3 flex items-start gap-2">
              <img
                src={user.imageUrl}
                alt=""
                className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5"
              />
              <div className="min-w-0">
                <p className="text-slate-300 text-xs font-medium truncate">
                  {user.fullName || user.primaryEmailAddress?.emailAddress}
                </p>
                {user.primaryEmailAddress?.emailAddress && user.fullName && (
                  <p className="text-slate-500 text-xs truncate">
                    {user.primaryEmailAddress.emailAddress}
                  </p>
                )}
                {user.externalAccounts?.length > 0 && (
                  <p className="text-slate-600 text-xs mt-0.5">
                    via{' '}
                    <span className="capitalize text-slate-500">
                      {user.externalAccounts[0].provider}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
          <button
            onClick={() => signOut({ redirectUrl: window.location.href })}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
          <button onClick={() => setOpen(true)} className="p-1 rounded-md hover:bg-slate-100">
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <span className="font-semibold text-slate-800">ChurchConnect Admin</span>
        </header>
        <main className="flex-1 overflow-y-auto p-5 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
