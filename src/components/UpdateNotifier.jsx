import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Download, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function UpdateNotifier() {
  const [state, setState] = useState('idle'); // idle | checking | available | downloading | downloaded | error | uptodate
  const [updateInfo, setUpdateInfo] = useState(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.getVersion().then(v => setVersion(v)).catch(() => {});

    const cleanups = [
      window.electronAPI.onUpdateChecking(() => setState('checking')),
      window.electronAPI.onUpdateAvailable((info) => {
        setUpdateInfo(info);
        setState('available');
        setOpen(true);
      }),
      window.electronAPI.onUpdateNotAvailable(() => {
        setState('uptodate');
        // Only show "up to date" if the user manually checked
        if (open) setOpen(true);
      }),
      window.electronAPI.onDownloadProgress((p) => {
        setState('downloading');
        setProgress(p.percent);
        setOpen(true);
      }),
      window.electronAPI.onUpdateDownloaded(() => {
        setState('downloaded');
        setOpen(true);
      }),
      window.electronAPI.onUpdateError((msg) => {
        setState('error');
        setErrorMsg(msg);
      }),
    ];

    return () => cleanups.forEach(fn => fn?.());
  }, []);

  function handleCheckNow() {
    setState('checking');
    setOpen(true);
    window.electronAPI?.checkForUpdates();
  }

  function handleInstall() {
    window.electronAPI?.installUpdate();
  }

  const statusIcon = {
    checking: <Loader2 className="w-5 h-5 animate-spin text-primary" />,
    available: <Download className="w-5 h-5 text-primary" />,
    downloading: <Loader2 className="w-5 h-5 animate-spin text-primary" />,
    downloaded: <CheckCircle className="w-5 h-5 text-green-600" />,
    uptodate: <CheckCircle className="w-5 h-5 text-green-600" />,
    error: <AlertCircle className="w-5 h-5 text-destructive" />,
    idle: null,
  }[state];

  return (
    <>
      {/* Trigger button (shown in app settings or header) */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCheckNow}
        className="gap-2 text-xs"
        disabled={state === 'checking' || state === 'downloading'}
      >
        {state === 'checking' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        Check for Updates
        {version && <span className="text-muted-foreground">v{version}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {statusIcon}
              {state === 'checking' && 'Checking for Updates…'}
              {state === 'available' && 'Update Available'}
              {state === 'downloading' && 'Downloading Update…'}
              {state === 'downloaded' && 'Ready to Install'}
              {state === 'uptodate' && 'You\'re Up to Date'}
              {state === 'error' && 'Update Check Failed'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {state === 'available' && updateInfo && (
              <>
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <p><span className="font-medium">Current:</span> v{version}</p>
                  <p><span className="font-medium">New:</span> v{updateInfo.version}</p>
                  {updateInfo.releaseDate && (
                    <p className="text-muted-foreground text-xs">Released {new Date(updateInfo.releaseDate).toLocaleDateString()}</p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  The update is downloading in the background. You'll be notified when it's ready to install.
                </p>
              </>
            )}

            {state === 'downloading' && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">{progress}% downloaded</p>
              </div>
            )}

            {state === 'downloaded' && (
              <>
                <p className="text-sm text-muted-foreground">
                  Update v{updateInfo?.version} is ready. Restart ChurchConnect to apply it.
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleInstall} className="flex-1">Restart & Install</Button>
                  <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Later</Button>
                </div>
              </>
            )}

            {state === 'uptodate' && (
              <p className="text-sm text-muted-foreground">
                ChurchConnect v{version} is the latest version. No updates available.
              </p>
            )}

            {state === 'error' && (
              <p className="text-sm text-muted-foreground">
                Could not check for updates: {errorMsg || 'Unknown error'}. Make sure you have an internet connection.
              </p>
            )}

            {state === 'checking' && (
              <p className="text-sm text-muted-foreground">Looking for new versions…</p>
            )}

            {(state === 'uptodate' || state === 'error' || state === 'checking' || state === 'available') && (
              <Button variant="outline" onClick={() => setOpen(false)} className="w-full">
                Close
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
