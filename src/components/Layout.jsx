import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/ClerkAuthContext";
import { entities } from "@/api/client";
import { useChurchSettings } from "@/lib/ChurchSettingsContext";
import {
  LayoutDashboard, Users, HandCoins, Receipt, Building2, Layers,
  Mic2, CalendarDays, ClipboardCheck, FileBarChart2, LogOut,
  Menu, ChevronRight, Home, PieChart, Settings, ShieldCheck,
  UsersRound, Heart, UserCheck, Megaphone, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";

const IS_ELECTRON = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

// Full feature-key → nav item map (used to build filtered dept navs)
const FEATURE_NAV = {
  members:               { label: "Members",              path: "/members",              icon: Users },
  giving:                { label: "Giving",               path: "/giving",               icon: HandCoins },
  expenditures:          { label: "Expenditures",         path: "/expenditures",         icon: Receipt },
  properties:            { label: "Properties",           path: "/properties",           icon: Building2 },
  sermons:               { label: "Sermons",              path: "/sermons",              icon: Mic2 },
  events:                { label: "Events",               path: "/events",               icon: CalendarDays },
  attendance:            { label: "Attendance",           path: "/attendance",           icon: ClipboardCheck },
  "attendance-analytics":{ label: "Attendance Analytics", path: "/attendance-analytics", icon: PieChart },
  volunteers:            { label: "Volunteers",           path: "/volunteers",           icon: UserCheck },
  "small-groups":        { label: "Small Groups",         path: "/small-groups",         icon: UsersRound },
  "pastoral-care":       { label: "Pastoral Care",        path: "/pastoral-care",        icon: Heart },
  announcements:         { label: "Announcements",        path: "/announcements",        icon: Megaphone },
  reports:               { label: "Reports",              path: "/reports",              icon: FileBarChart2 },
};

const NAV = {
  super_admin: [
    { label: "Dashboard",            path: "/",                    icon: LayoutDashboard },
    { label: "Members",              path: "/members",              icon: Users },
    { label: "Giving",               path: "/giving",               icon: HandCoins },
    { label: "Expenditures",         path: "/expenditures",         icon: Receipt },
    { label: "Properties",           path: "/properties",           icon: Building2 },
    { label: "Departments",          path: "/departments",          icon: Layers },
    { label: "Small Groups",         path: "/small-groups",         icon: UsersRound },
    { label: "Sermons",              path: "/sermons",              icon: Mic2 },
    { label: "Events",               path: "/events",               icon: CalendarDays },
    { label: "Attendance",           path: "/attendance",           icon: ClipboardCheck },
    { label: "Attendance Analytics", path: "/attendance-analytics", icon: PieChart },
    { label: "Volunteers",           path: "/volunteers",           icon: UserCheck },
    { label: "Pastoral Care",        path: "/pastoral-care",        icon: Heart },
    { label: "Announcements",        path: "/announcements",        icon: Megaphone },
    { label: "Reports",              path: "/reports",              icon: FileBarChart2 },
  ],
  pastor_admin: [
    { label: "Dashboard",            path: "/",                    icon: LayoutDashboard },
    { label: "Members",              path: "/members",              icon: Users },
    { label: "Giving",               path: "/giving",               icon: HandCoins },
    { label: "Expenditures",         path: "/expenditures",         icon: Receipt },
    { label: "Properties",           path: "/properties",           icon: Building2 },
    { label: "Small Groups",         path: "/small-groups",         icon: UsersRound },
    { label: "Sermons",              path: "/sermons",              icon: Mic2 },
    { label: "Events",               path: "/events",               icon: CalendarDays },
    { label: "Attendance",           path: "/attendance",           icon: ClipboardCheck },
    { label: "Attendance Analytics", path: "/attendance-analytics", icon: PieChart },
    { label: "Volunteers",           path: "/volunteers",           icon: UserCheck },
    { label: "Pastoral Care",        path: "/pastoral-care",        icon: Heart },
    { label: "Announcements",        path: "/announcements",        icon: Megaphone },
    { label: "Reports",              path: "/reports",              icon: FileBarChart2 },
  ],
  finance_officer: [
    { label: "Dashboard", path: "/",              icon: LayoutDashboard },
    { label: "Giving",    path: "/giving",        icon: HandCoins },
    { label: "Expenditures", path: "/expenditures", icon: Receipt },
    { label: "Reports",   path: "/reports",       icon: FileBarChart2 },
  ],
  member: [
    { label: "My Portal", path: "/portal", icon: Home },
  ],
};

// dept dashboard item always included for dept roles
const DEPT_DASHBOARD_ITEM = { label: "Dept. Dashboard", path: "/dept-dashboard", icon: LayoutDashboard };

export default function Layout() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [department, setDepartment] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, loading: settingsLoading, reload: reloadSettings } = useChurchSettings();

  // Retry loading settings if the initial fetch failed (e.g. auth not ready yet)
  useEffect(() => {
    if (!settingsLoading && !settings) reloadSettings();
  }, [settingsLoading]);

  const role = user?.role || "member";
  const deptId = user?.data?.department_id;
  const isDeptRole = ["department_head", "data_entry_staff"].includes(role) || (role === "member" && !!deptId);

  // Load department for dept-scoped roles
  useEffect(() => {
    if (isDeptRole && deptId) {
      entities.Department.filter({ id: deptId })
        .then(rows => setDepartment(rows[0] || null))
        .catch(() => {});
    }
  }, [role, deptId]);

  // Pending access requests badge
  useEffect(() => {
    if (["super_admin", "pastor_admin"].includes(role)) {
      entities.AccessRequest.filter({ status: "pending" })
        .then(reqs => setPendingRequests(reqs.length))
        .catch(() => {});
    }
  }, [role]);

  // Build nav items
  let navItems;
  if (isDeptRole) {
    const allowed = (department?.allowed_features || "").split(",").filter(Boolean);
    const filteredFeatures = allowed.length
      ? allowed.map(k => FEATURE_NAV[k]).filter(Boolean)
      : Object.values(FEATURE_NAV); // no restriction if not configured yet
    navItems = [DEPT_DASHBOARD_ITEM, ...filteredFeatures];
  } else {
    navItems = NAV[role] || NAV.member;
  }

  const handleLogout = () => signOut("/login");

  // dept colour accent for sidebar header
  const deptColor = isDeptRole && department?.color ? department.color : null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {open && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setOpen(false)} />}

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
            {role === "super_admin" ? (
              <Link to="/church-settings" className="font-bold text-sm leading-tight hover:underline hover:opacity-80 transition-opacity">
                {settings?.church_name || "ChurchConnect"}
              </Link>
            ) : (
              <p className="font-bold text-sm leading-tight">{settings?.church_name || "ChurchConnect"}</p>
            )}
            {isDeptRole && department ? (
              <p className="text-xs text-primary-foreground/60 flex items-center gap-1">
                {deptColor && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: deptColor }} />}
                {department.name}
              </p>
            ) : (
              <p className="text-xs text-primary-foreground/60">Church CRM</p>
            )}
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
                  ${active ? "bg-white/20 text-white" : "text-primary-foreground/70 hover:bg-white/10 hover:text-white"}`}
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
              {IS_ELECTRON ? (
                <p className="text-xs font-semibold text-primary-foreground/80 truncate">{user.full_name || user.email}</p>
              ) : (
                <Link to="/profile" className="text-xs font-semibold text-primary-foreground/80 truncate hover:underline hover:opacity-80 transition-opacity">
                  {user.full_name || user.email}
                </Link>
              )}
              <p className="text-xs text-primary-foreground/50 capitalize">{role.replace(/_/g, " ")}</p>
            </div>
          )}
          {["super_admin", "pastor_admin"].includes(role) && (
            <Link
              to="/access-requests"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors mb-1 ${
                location.pathname === "/access-requests" ? "bg-white/20 text-white" : "text-primary-foreground/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              Access Requests
              {pendingRequests > 0 && (
                <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                  {pendingRequests}
                </span>
              )}
            </Link>
          )}
          {role === "super_admin" && (
            <Link
              to="/pricing"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors mb-1 ${
                location.pathname === "/pricing" ? "bg-white/20 text-white" : "text-primary-foreground/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Zap className="w-4 h-4" />
              Upgrade Plan
            </Link>
          )}
          {role === "super_admin" && (
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

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Logo watermark — barely visible brand background */}
        {settings?.logo_url && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
            aria-hidden="true"
          >
            <img
              src={settings.logo_url}
              alt=""
              className="w-3/4 max-w-[520px] object-contain"
              style={{ opacity: 0.05 }}
            />
          </div>
        )}
        <header className="relative z-10 lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-primary">
            {isDeptRole && department ? department.name : (settings?.church_name || "ChurchConnect")}
          </span>
        </header>
        <main className="relative z-10 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}
