import { useState, useEffect } from 'react';
import { Sparkles, X, CheckCircle, Wrench, ChevronDown, ChevronUp } from 'lucide-react';

const STORAGE_KEY = 'cc_whats_new_version';

function semverGt(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

function EntryBlock({ entry, expanded, onToggle, isLatest }) {
  return (
    <div className={`rounded-xl border ${isLatest ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          {isLatest && (
            <span className="flex-shrink-0 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full uppercase tracking-wide">
              New
            </span>
          )}
          <span className="font-semibold text-sm text-foreground truncate">{entry.title}</span>
          <span className="flex-shrink-0 text-xs text-muted-foreground font-mono">v{entry.version}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 text-muted-foreground">
          <span className="text-xs">{new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {entry.features?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Features</p>
              <ul className="space-y-1.5">
                {entry.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {entry.fixes?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Bug Fixes</p>
              <ul className="space-y-1.5">
                {entry.fixes.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Wrench className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WhatsNewModal() {
  const [open, setOpen] = useState(false);
  const [changelog, setChangelog] = useState([]);
  const [newEntries, setNewEntries] = useState([]);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    fetch('/changelog.json')
      .then(r => r.json())
      .then(data => {
        setChangelog(data);
        const seen = localStorage.getItem(STORAGE_KEY);
        const latest = data[0]?.version;
        if (latest && (!seen || semverGt(latest, seen))) {
          const fresh = seen ? data.filter(e => semverGt(e.version, seen)) : [data[0]];
          setNewEntries(fresh);
          // auto-expand new entries
          const ex = {};
          fresh.forEach(e => { ex[e.version] = true; });
          setExpanded(ex);
          setOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  function handleDismiss() {
    const latest = changelog[0]?.version;
    if (latest) localStorage.setItem(STORAGE_KEY, latest);
    setOpen(false);
  }

  function toggleExpanded(version) {
    setExpanded(prev => ({ ...prev, [version]: !prev[version] }));
  }

  if (!open || newEntries.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleDismiss} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-background rounded-2xl shadow-2xl border border-border flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">
                {newEntries.length === 1 ? "What's New" : `${newEntries.length} Updates`}
              </p>
              <p className="text-xs text-muted-foreground">ChurchConnect v{changelog[0]?.version}</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 space-y-3 flex-1">
          {newEntries.map((entry, i) => (
            <EntryBlock
              key={entry.version}
              entry={entry}
              isLatest={i === 0}
              expanded={!!expanded[entry.version]}
              onToggle={() => toggleExpanded(entry.version)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <button
            onClick={handleDismiss}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-xl transition-colors"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
