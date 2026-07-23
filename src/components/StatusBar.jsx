import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAutoUpdater } from '@/hooks/useAutoUpdater';
import { Progress } from '@/components/ui/progress';
import {
  RefreshCw, Download, CheckCircle2, AlertCircle, Loader2, Wifi, WifiOff,
  Cloud, CloudOff, RotateCw, X,
} from 'lucide-react';

const api = () => (typeof window !== 'undefined' ? window.electronAPI : null);

// Persistent bottom status bar for the standalone app: Online · Cloud sync
// (+ last-synced + enable) · Auto-update (inline, replaces the old corner popup).
export default function StatusBar() {
  const upd = useAutoUpdater();
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [sync, setSync] = useState(null); // null => sync unsupported (hide segment)
  const [showEnable, setShowEnable] = useState(false);
  const [creds, setCreds] = useState({ email: '', password: '' });
  const [enabling, setEnabling] = useState(false);
  const [enableErr, setEnableErr] = useState('');
  const [, setTick] = useState(0); // periodic re-render for relative time

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const refreshSync = useCallback(() => { api()?.getSyncStatus?.().then(setSync).catch(() => setSync(null)); }, []);
  useEffect(() => {
    if (!api()?.onSyncStatus) return;
    refreshSync();
    const off = api().onSyncStatus((s) => setSync(s));
    return () => off?.();
  }, [refreshSync]);

  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 30000); return () => clearInterval(t); }, []);

  if (!api()) return null; // only in the desktop app

  const cloudReachable = online && sync?.online !== false;

  async function doEnable(e) {
    e?.preventDefault();
    setEnabling(true); setEnableErr('');
    try {
      const r = await api().enableSync(creds.email.trim(), creds.password);
      if (r?.ok) { setShowEnable(false); setCreds({ email: '', password: '' }); refreshSync(); }
      else setEnableErr(r?.error || 'Could not enable sync');
    } catch { setEnableErr('Could not enable sync'); }
    finally { setEnabling(false); }
  }

  async function doDisable() {
    try { await api().disableSync?.(); } finally { refreshSync(); }
  }

  const dot = (cls) => <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;

  // ── sync segment ──
  function SyncSegment() {
    if (sync === null) return null;
    if (!sync.enabled) {
      return (
        <button onClick={() => { setShowEnable(true); setEnableErr(''); }} className="flex items-center gap-1.5 hover:text-foreground">
          <CloudOff className="w-3.5 h-3.5" /> Cloud sync off <span className="text-primary underline">Enable</span>
        </button>
      );
    }
    if (sync.state === 'syncing') return <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Syncing…</span>;
    if (sync.state === 'offline') return <span className="flex items-center gap-1.5 text-muted-foreground"><CloudOff className="w-3.5 h-3.5" /> Sync paused · offline</span>;
    if (sync.state === 'auth') {
      return (
        <button onClick={() => { setShowEnable(true); setEnableErr(''); }} className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700">
          <AlertCircle className="w-3.5 h-3.5" /> Reconnect sync
        </button>
      );
    }
    if (sync.state === 'error') {
      return (
        <span className="flex items-center gap-1.5 text-destructive">
          <AlertCircle className="w-3.5 h-3.5" /> Sync error
          <button onClick={() => api().syncNow()} className="text-primary hover:underline">Retry</button>
        </span>
      );
    }
    // idle / synced
    return (
      <span className="flex items-center gap-1.5">
        <Cloud className="w-3.5 h-3.5 text-primary" /> Synced
        {sync.lastSyncAt && <span className="text-muted-foreground">· {formatDistanceToNow(new Date(sync.lastSyncAt), { addSuffix: true })}</span>}
        {sync.pending > 0 && <span className="text-amber-600" title="Records waiting to sync — they will retry automatically">· {sync.pending} pending</span>}
        <button onClick={() => api().syncNow()} className="text-primary hover:underline flex items-center gap-1" title="Sync now"><RotateCw className="w-3 h-3" />Sync now</button>
        <button onClick={doDisable} className="text-muted-foreground hover:text-destructive" title="Turn off cloud sync on this device">Turn off</button>
      </span>
    );
  }

  // ── update segment ──
  function UpdateSegment() {
    const s = upd.state;
    if (s === 'checking') return <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…</span>;
    if (s === 'available') return (
      <span className="flex items-center gap-1.5">
        <Download className="w-3.5 h-3.5 text-primary" /> Update v{upd.updateInfo?.version} available
        <button onClick={upd.handleDownload} className="text-primary hover:underline font-medium">Download</button>
      </span>
    );
    if (s === 'downloading') return (
      <span className="flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Downloading update
        <Progress value={upd.progress} className="h-1.5 w-20" />
        <span className="tabular-nums text-muted-foreground">{upd.progress}%</span>
      </span>
    );
    if (s === 'downloaded') return (
      <span className="flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Update ready
        <button onClick={upd.handleInstall} className="text-primary hover:underline font-medium">Restart to update</button>
      </span>
    );
    if (s === 'installing') return <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Installing…</span>;
    if (s === 'uptodate') return <span className="flex items-center gap-1.5 text-green-600"><CheckCircle2 className="w-3.5 h-3.5" /> Up to date</span>;
    if (s === 'error') return (
      <span className="flex items-center gap-1.5 text-destructive">
        <AlertCircle className="w-3.5 h-3.5" /> Update failed
        <button onClick={upd.startManualCheck} className="text-primary hover:underline">Retry</button>
      </span>
    );
    // idle
    return (
      <button onClick={upd.startManualCheck} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground" title="Check for updates">
        <RefreshCw className="w-3 h-3" /> {upd.version ? `v${upd.version}` : 'Check for updates'}
      </button>
    );
  }

  return (
    <>
      {showEnable && (
        <div className="fixed bottom-9 left-3 z-50 w-72 bg-white border border-border rounded-xl shadow-lg p-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">Enable cloud sync</p>
            <button onClick={() => setShowEnable(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Sign in with your ChurchConnect account once to sync this device with the cloud.</p>
          <form onSubmit={doEnable} className="space-y-2">
            <input type="email" required autoFocus placeholder="Email" value={creds.email} onChange={(e) => setCreds((p) => ({ ...p, email: e.target.value }))} className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <input type="password" required placeholder="Password" value={creds.password} onChange={(e) => setCreds((p) => ({ ...p, password: e.target.value }))} className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            {enableErr && <p className="text-xs text-destructive">{enableErr}</p>}
            <button type="submit" disabled={enabling} className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium disabled:opacity-60">{enabling ? 'Connecting…' : 'Enable sync'}</button>
          </form>
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 z-40 h-8 flex items-center justify-between gap-4 px-3 text-[11px] bg-white border-t border-border select-none">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center gap-1.5" title={cloudReachable ? 'Online' : 'Offline'}>
            {cloudReachable ? <Wifi className="w-3.5 h-3.5 text-green-600" /> : <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />}
            {dot(cloudReachable ? 'bg-green-500' : 'bg-gray-400')}
            {!online ? 'Offline' : cloudReachable ? 'Online' : 'Cloud unreachable'}
          </span>
          {sync !== null && <span className="text-border">|</span>}
          <div className="truncate"><SyncSegment /></div>
        </div>
        <div className="flex-shrink-0"><UpdateSegment /></div>
      </div>
    </>
  );
}
