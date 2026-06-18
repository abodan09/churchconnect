import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useChurchSettings } from "@/lib/ChurchSettingsContext";
import {
  LayoutDashboard, Users, HandCoins, Receipt, Building2, Layers,
  Mic2, CalendarDays, ClipboardCheck, FileBarChart2, LogOut,
  Menu, X, ChevronRight, Home, PieChart, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = {
  super_admin: [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { label: "Members", path: "/members", icon: Users },
    { label: "Giving", path: "/giving", icon: HandCoins },
    { label: "Expenditures", path: "/expenditures", icon: Receipt },
    { label: "Properties", path: "/properties", icon: Building2 },
    { label: "Departments", path: "/departments", icon: Layers },
    { label: "Sermons", path: "/sermons", icon: Mic2 },
    { label: "Events", path: "/events", icon: CalendarDays },
    { label: "Attendance", path: "/attendance", icon: ClipboardCheck },
    { label: "Attendance Analytics", path: "/attendance-analytics", icon: PieChart },
    { label: "Reports", path: "/reports", icon: FileBarChart2 },
  ],
  pastor_admin: [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { label: "Members", path: "/members", icon: Users },
    { label: "Giving", path: "/giving", icon: HandCoins },
    { label: "Expenditures", path: "/expenditures", icon: Receipt },
    { label: "Properties", path: "/properties", icon: Building2 },
    { label: "Sermons", path: "/sermons", icon: Mic2 },
    { label: "Events", path: "/events", icon: CalendarDays },
    { label: "Attendance", path: "/attendance", icon: ClipboardCheck },
    { label: "Attendance Analytics", path: "/attendance-analytics", icon: PieChart },
    { label: "Reports", path: "/reports", icon: FileBarChart2 },
  ],
  finance_officer: [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { label: "Giving", path: "/giving", icon: HandCoins },
    { label: "Expenditures", path: "/expenditures", icon: Receipt },
    { label: "Reports", path: "/reports", icon: FileBarChart2 },
  ],
  department_head: [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { label: "Events", path: "/events", icon: CalendarDays },
    { label: "Attendance", path: "/attendance", icon: ClipboardCheck },
    { label: "Sermons", path: "/sermons", icon: Mic2 },
  ],
  data_entry_staff: [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { label: "Members", path: "/members", icon: Users },
    { label: "Giving", path: "/giving", icon: HandCoins },
    { label: "Attendance", path: "/attendance", icon: ClipboardCheck },
  ],
  member: [
    { label: "My Portal", path: "/portal", icon: Home },
  ],
};

export default function Layout() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, loading: settingsLoading } = useChurchSettings();

  // Redirect to setup if no settings configured (admin only)
  useEffect(() => {
    if (!settingsLoading && !settings) {
      navigate("/setup");
    }
  }, [settings, settingsLoading, navigate]);

  useEffect(() => {
    base44.auth.me()
      .then(setUser)
      .catch(() => navigate("/login", { replace: true }));
  }, [navigate]);

  const rawRole = user?.role || "member";
  // Map base44 built-in roles to app roles
  const role = rawRole === "admin" ? "super_admin" : rawRole;
  const navItems = NAV[role] || NAV.member;

  const handleLogout = () => base44.auth.logout("/login");

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col bg-primary text-primary-foreground
        transform transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="logo" className="w-9 h-9 rounded-full object-cover bg-primary-foreground/20" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <span className="text-lg font-bold">✝</span>
            </div>
          )}
          <div>
            <p className="font-bold text-sm leading-tight">{settings?.church_name || "ChurchConnect"}</p>
            <p className="text-xs text-primary-foreground/60">Church CRM</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map(({ label, path, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? "bg-white/20 text-white"
                    : "text-primary-foreground/70 hover:bg-white/10 hover:text-white"
                  }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          {user && (
            <div className="px-3 mb-3">
              <p className="text-xs font-semibold text-primary-foreground/80 truncate">{user.full_name}</p>
              <p className="text-xs text-primary-foreground/50 capitalize">{role.replace(/_/g, " ")}</p>
            </div>
          )}
          {(role === "super_admin") && (
            <Link
              to="/church-settings"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors mb-1 ${
                location.pathname === "/church-settings" ? "bg-white/20 text-white" : "text-primary-foreground/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Settings className="w-4 h-4" />
              Church Settings
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-primary-foreground/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-primary">{settings?.church_name || "ChurchConnect"}</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}