import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, RefreshCw, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

// Non-blocking updater. A small card in the bottom-right corner replaces the old
// full-screen modal, so the app stays fully usable while an update is handled.
//
// Auto (background) flow:   available → [Download] → progress → [Update] → install
// Manual (user-triggered):  check → downloads immediately → progress → installs
//                           (no second confirmation, since the user asked for it)
export default function UpdateNotifier() {
  const [state, setState] = useState('idle'); // idle|checking|available|downloading|downloaded|installing|uptodate|error
  const [updateInfo, setUpdateInfo] = useState(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [version, setVersion] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const flow = useRef('auto'); // 'auto' | 'manual'
  const stateRef = useRef('idle'); // mirrors `state` for event handlers (which close over stale state)

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getVersion().then(setVersion).catch(() => {});

    const cleanups = [
      window.electronAPI.onUpdateChecking(() => setState('checking')),

      window.electronAPI.onUpdateAvailable((info) => {
        setUpdateInfo(info);
        setDismissed(false);
        if (flow.current === 'manual') {
          // The user already asked for the update — download straight away.
          setProgress(0);
          setState('downloading');
          window.electronAPI.downloadUpdate();
        } else {
          setState('available'); // wait for the user to confirm the download
        }
      }),

      window.electronAPI.onUpdateNotAvailable(() => {
        if (flow.current === 'manual') { setDismissed(false); setState('uptodate'); }
        else setState('idle');
      }),

      window.electronAPI.onDownloadProgress((p) => {
        setState('downloading');
        setProgress(p.percent);
      }),

      window.electronAPI.onUpdateDownloaded(() => {
        if (flow.current === 'manual') {
          // No second confirmation for a manually-triggered update.
          setState('installing');
          window.electronAPI.installUpdate();
        } else {
          setDismissed(false);
          setState('downloaded'); // wait for the user to click "Update"
        }
      }),

      window.electronAPI.onUpdateError((msg) => {
        setErrorMsg(msg);
        // Surface the error whenever the user was actively engaged — a manual
        // check, or a download/install they initiated. Stay silent only for
        // failures during a purely background check the user never acted on.
        const engaged = flow.current === 'manual' || stateRef.current === 'downloading' || stateRef.current === 'installing';
        if (engaged) { setDismissed(false); setState('error'); }
        else { setState('idle'); flow.current = 'auto'; }
      }),

      window.electronAPI.onMenuCheckForUpdates?.(() => startManualCheck()),
    ];

    return () => cleanups.forEach((fn) => fn?.());
  }, []);

  // Transient states auto-clear (and reset the flow). The 'checking' watchdog also
  // recovers the UI if the update service never responds (e.g. a non-packaged dev
  // run has no IPC handler, or a stalled network on a real check).
  useEffect(() => {
    if (state === 'uptodate') {
      const t = setTimeout(() => { setState('idle'); flow.current = 'auto'; }, 4000);
      return () => clearTimeout(t);
    }
    if (state === 'error') {
      const t = setTimeout(() => { setState('idle'); flow.current = 'auto'; }, 8000);
      return () => clearTimeout(t);
    }
    if (state === 'checking') {
      const t = setTimeout(() => {
        if (flow.current === 'manual') {
          setErrorMsg('No response from the update service. Please try again later.');
          setState('error');
        } else {
          setState('idle');
        }
      }, 20000);
      return () => clearTimeout(t);
    }
  }, [state]);

  function startManualCheck() {
    flow.current = 'manual';
    setDismissed(false);
    setState('checking');
    window.electronAPI?.checkForUpdates();
  }

  function handleDownload() {
    setProgress(0);
    setState('downloading');
    window.electronAPI?.downloadUpdate();
  }

  function handleInstall() {
    setState('installing');
    window.electronAPI?.installUpdate();
  }

  const busy = state === 'checking' || state === 'downloading' || state === 'installing';

  const showBanner = !dismissed && (
    state === 'available' || state === 'downloading' || state === 'downloaded' ||
    state === 'installing' || state === 'error' ||
    (flow.current === 'manual' && (state === 'checking' || state === 'uptodate'))
  );

  const meta = {
    checking:    { icon: <Loader2 className="w-5 h-5 animate-spin text-primary" />, title: 'Checking for updates…', sub: 'Looking for a newer version.' },
    available:   { icon: <Download className="w-5 h-5 text-primary" />, title: 'Update available', sub: `v${version} → v${updateInfo?.version}` },
    downloading: { icon: <Loader2 className="w-5 h-5 animate-spin text-primary" />, title: 'Downloading update…', sub: `Version ${updateInfo?.version || ''}`.trim() },
    downloaded:  { icon: <CheckCircle className="w-5 h-5 text-green-600" />, title: 'Update ready', sub: `Restart to apply v${updateInfo?.version}.` },
    installing:  { icon: <Loader2 className="w-5 h-5 animate-spin text-primary" />, title: 'Installing update…', sub: 'ChurchConnect will restart.' },
    uptodate:    { icon: <CheckCircle className="w-5 h-5 text-green-600" />, title: "You're up to date", sub: `v${version} is the latest version.` },
    error:       { icon: <AlertCircle className="w-5 h-5 text-destructive" />, title: 'Update failed', sub: errorMsg || 'Something went wrong.' },
  }[state] || {};

  const canDismiss = ['available', 'downloading', 'downloaded', 'uptodate', 'error'].includes(state);

  return (
    <>
      {/* Manual trigger (rendered wherever this component is mounted) */}
      <Button
        variant="ghost"
        size="sm"
        onClick={startManualCheck}
        className="gap-2 text-xs"
        disabled={busy}
      >
        {state === 'checking' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        Check for Updates
        {version && <span className="text-muted-foreground">v{version}</span>}
      </Button>

      {showBanner && (
        <div className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] bg-white border border-border rounded-xl shadow-lg p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">{meta.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">{meta.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 break-words">{meta.sub}</p>
            </div>
            {canDismiss && (
              <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {state === 'downloading' && (
            <div className="mt-3 space-y-1">
              <Progress value={progress} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground text-right">{progress}%</p>
            </div>
          )}

          {state === 'available' && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={handleDownload} className="flex-1 gap-1.5">
                <Download className="w-3.5 h-3.5" /> Download
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDismissed(true)} className="flex-1">Not now</Button>
            </div>
          )}

          {state === 'downloaded' && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={handleInstall} className="flex-1">Update</Button>
              <Button size="sm" variant="outline" onClick={() => setDismissed(true)} className="flex-1">Later</Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
