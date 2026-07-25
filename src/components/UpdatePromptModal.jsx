import { useState, useEffect } from 'react';
import { Download, X, CheckCircle, Wrench, Loader2, RotateCw } from 'lucide-react';

// Parse the GitHub release body (Markdown produced by scripts/release.cjs) into
// { features, fixes }, keeping only the New Features / Bug Fixes bullets and
// dropping the Download / Requirements installer boilerplate. Returns null if there
// is nothing meaningful, so the modal can fall through to a generic message rather
// than dumping raw Markdown.
function parseReleaseNotes(md) {
  if (typeof md !== 'string' || !md.trim()) return null;
  const features = [];
  const fixes = [];
  let bucket = null;
  for (const raw of md.replace(/<[^>]+>/g, '').split('\n')) {
    const line = raw.trim();
    const heading = line.match(/^#{1,4}\s+(.*)/);
    if (heading) {
      const t = heading[1].toLowerCase();
      bucket = /feature/.test(t) ? features : /fix/.test(t) ? fixes : null; // title/Download/Requirements -> ignore
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)/);
    if (bullet && bucket) bucket.push(bullet[1].replace(/\*\*/g, '').trim());
  }
  return (features.length || fixes.length) ? { features, fixes } : null;
}

// Shown before an update installs: what the new version contains + Cancel/Update.
// Changelog source (best → fallback): the desktop /api/changelog proxy (server-side
// fetch of the always-current cloud changelog, structured features/fixes) → the
// GitHub releaseNotes (parsed) → a generic message.
export default function UpdatePromptModal({ version, releaseNotes, onCancel, onConfirm }) {
  const [entry, setEntry] = useState(null);   // structured { title, features, fixes }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const base = window.electronAPI?.apiBase || 'http://localhost:14747';
        const data = await (await fetch(`${base}/api/changelog`)).json();
        const e = Array.isArray(data) ? data.find((x) => x.version === version) : null;
        // Only use an entry that actually has content; otherwise fall through.
        if (!cancelled && e && (e.features?.length || e.fixes?.length)) setEntry(e);
      } catch { /* fall back to releaseNotes below */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [version]);

  const display = entry || parseReleaseNotes(releaseNotes); // { title?, features, fixes } | null

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative w-full max-w-md bg-background rounded-2xl shadow-2xl border border-border flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Download className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">Update available</p>
              <p className="text-xs text-muted-foreground">ChurchConnect v{version}{display?.title ? ` — ${display.title}` : ''}</p>
            </div>
          </div>
          <button onClick={onCancel} aria-label="Close" className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* What's in the update */}
        <div className="overflow-y-auto px-5 py-4 space-y-3 flex-1 text-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading what's new…</div>
          ) : display ? (
            <>
              {display.features?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">New</p>
                  <ul className="space-y-1.5">
                    {display.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-foreground"><CheckCircle className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {display.fixes?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Fixes</p>
                  <ul className="space-y-1.5">
                    {display.fixes.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-muted-foreground"><Wrench className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">A new version is ready. Update to get the latest features and fixes.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border space-y-2.5">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <RotateCw className="w-3 h-3" /> The app will download the update and restart to apply it.
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex-1 py-2.5 border border-border hover:bg-muted text-foreground font-medium text-sm rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={onConfirm} className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Update now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
