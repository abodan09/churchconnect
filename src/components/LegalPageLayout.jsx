import { Link } from "react-router-dom";
import PoweredBy from "@/components/PoweredBy";

// Shared shell for the public legal pages (Terms, Privacy). Self-contained and
// styled without a typography plugin, so plain <h2>/<p>/<ul> inside `children`
// are formatted consistently.
const IS_ELECTRON = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

export default function LegalPageLayout({ title, lastUpdated, children }) {
  return (
    // Reserve the desktop status bar's height so its fixed bar never covers the footer.
    <div className={`min-h-screen bg-background text-foreground ${IS_ELECTRON ? 'pb-8' : ''}`}>
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">✝</span>
            ChurchConnect
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">Last updated: {lastUpdated}</p>

        <div
          className="mt-8 space-y-4
            [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-2
            [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-5 [&_h3]:mb-1
            [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ul]:text-sm [&_ul]:text-muted-foreground
            [&_li]:leading-relaxed
            [&_a]:text-primary [&_a]:underline"
        >
          {children}
        </div>

        <footer className="mt-12 pt-6 border-t border-border space-y-3">
          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-2">
            <Link to="/" className="hover:text-foreground">← Home</Link>
            <Link to="/about" className="hover:text-foreground">About</Link>
            <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <span className="ml-auto">© {new Date().getFullYear()} FrozenBit</span>
          </div>
          <PoweredBy />
        </footer>
      </main>
    </div>
  );
}
