import { useState, useEffect, useRef } from 'react';

// Auto-updater state machine, extracted from UpdateNotifier so the StatusBar can
// render it inline. Logic only, no JSX.
//   Auto flow:   available -> [Download] -> progress -> [Update] -> install
//   Manual flow: (menu / "Check for updates") downloads then installs, no 2nd confirm
export function useAutoUpdater() {
  const [state, setState] = useState('idle'); // idle|checking|available|downloading|downloaded|installing|uptodate|error
  const [updateInfo, setUpdateInfo] = useState(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [version, setVersion] = useState('');
  const flow = useRef('auto');       // 'auto' | 'manual'
  const autoInstall = useRef(false); // set when the user confirms the update prompt: install as soon as the download finishes
  const stateRef = useRef('idle');   // mirrors state for stale-closure event handlers

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (!window.electronAPI?.onUpdateChecking) return;
    window.electronAPI.getVersion?.().then(setVersion).catch(() => {});
    const cleanups = [
      window.electronAPI.onUpdateChecking(() => setState('checking')),
      window.electronAPI.onUpdateAvailable((info) => {
        setUpdateInfo(info);
        if (flow.current === 'manual') { setProgress(0); setState('downloading'); window.electronAPI.downloadUpdate(); }
        else setState('available');
      }),
      window.electronAPI.onUpdateNotAvailable(() => setState(flow.current === 'manual' ? 'uptodate' : 'idle')),
      window.electronAPI.onDownloadProgress((p) => { setState('downloading'); setProgress(p.percent); }),
      window.electronAPI.onUpdateDownloaded(() => {
        if (flow.current === 'manual' || autoInstall.current) { setState('installing'); window.electronAPI.installUpdate(); }
        else setState('downloaded');
      }),
      window.electronAPI.onUpdateError((msg) => {
        setErrorMsg(msg);
        autoInstall.current = false;
        const engaged = flow.current === 'manual' || stateRef.current === 'downloading' || stateRef.current === 'installing';
        if (engaged) setState('error');
        else { setState('idle'); flow.current = 'auto'; }
      }),
      window.electronAPI.onMenuCheckForUpdates?.(() => startManualCheck()),
    ];
    return () => cleanups.forEach((fn) => fn?.());
  }, []);

  // Transient states auto-clear; the 'checking' watchdog recovers a stalled check.
  useEffect(() => {
    if (state === 'uptodate') { const t = setTimeout(() => { setState('idle'); flow.current = 'auto'; }, 4000); return () => clearTimeout(t); }
    if (state === 'error') { const t = setTimeout(() => { setState('idle'); flow.current = 'auto'; }, 8000); return () => clearTimeout(t); }
    if (state === 'checking') {
      const t = setTimeout(() => {
        if (flow.current === 'manual') { setErrorMsg('No response from the update service. Please try again later.'); setState('error'); }
        else setState('idle');
      }, 20000);
      return () => clearTimeout(t);
    }
  }, [state]);

  function startManualCheck() { flow.current = 'manual'; setState('checking'); window.electronAPI?.checkForUpdates(); }
  function handleDownload() { setProgress(0); setState('downloading'); window.electronAPI?.downloadUpdate(); }
  function handleInstall() { setState('installing'); window.electronAPI?.installUpdate(); }
  // User confirmed the changelog prompt: download now and install the moment it finishes.
  function handleUpdateNow() { autoInstall.current = true; setProgress(0); setState('downloading'); window.electronAPI?.downloadUpdate(); }

  return { state, updateInfo, progress, errorMsg, version, startManualCheck, handleDownload, handleInstall, handleUpdateNow };
}
