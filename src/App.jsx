import { ClerkProvider } from '@clerk/clerk-react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, AuthContext, useAuth } from '@/lib/ClerkAuthContext';
import { ElectronAuthProvider, useAuth as useLocalAuth } from '@/lib/ElectronAuthContext';

// Bridges ElectronAuthContext into AuthContext so all pages that call
// useAuth() from ClerkAuthContext get real data in Electron mode too.
function ElectronAuthBridge({ children }) {
  const auth = useLocalAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MemberPortal from './pages/MemberPortal';
import Members from './pages/Members';
import GivingPage from './pages/GivingPage';
import ExpenditurePage from './pages/ExpenditurePage';
import PropertiesPage from './pages/PropertiesPage';
import DepartmentsPage from './pages/DepartmentsPage';
import SermonsPage from './pages/SermonsPage';
import EventsPage from './pages/EventsPage';
import AttendancePage from './pages/AttendancePage';
import FinancialReportsPage from './pages/FinancialReportsPage';
import AttendanceAnalyticsPage from './pages/AttendanceAnalyticsPage';
import ChurchSetupPage from './pages/ChurchSetupPage';
import ChurchSettingsPage from './pages/ChurchSettingsPage';
import { ChurchSettingsProvider } from './lib/ChurchSettingsContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import RequestAccessPage from './pages/RequestAccessPage';
import AccessRequestsAdminPage from './pages/AccessRequestsAdminPage';
import SmallGroupsPage from './pages/SmallGroupsPage';
import DepartmentDashboard from './pages/DepartmentDashboard';
import PastoralCarePage from './pages/PastoralCarePage';
import VolunteerPage from './pages/VolunteerPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import AIAssistant from './components/AIAssistant';
import LocalSetupPage from './pages/LocalSetupPage';
import LocalLoginPage from './pages/LocalLoginPage';
import OnboardingPage from './pages/OnboardingPage';
import PricingPage from './pages/PricingPage';
import UpdateNotifier from './components/UpdateNotifier';
import WhatsNewModal from './components/WhatsNewModal';
import UserProfilePage from './pages/UserProfilePage';
import JoinChurchPage from './pages/JoinChurchPage';

const IS_ELECTRON = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

// Use prefix matching so Clerk's sub-paths (/login/tasks/*, /register/verify-*) are treated as public
const PUBLIC_PATH_PREFIXES = ['/login', '/register', '/request-access', '/forgot-password', '/reset-password'];
function isPublicPathname(pathname) {
  return PUBLIC_PATH_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, needsOnboarding } = useAuth();
  const location = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated && !isPublicPathname(location.pathname)) {
    return <Navigate to="/login" replace />;
  }

  // Signed-in but no church yet → must complete onboarding or join a church.
  // Also exempt any Clerk task sub-paths so we don't interrupt the login flow.
  const ONBOARDING_EXEMPT = ['/onboarding', '/join-church'];
  if (
    needsOnboarding &&
    !ONBOARDING_EXEMPT.includes(location.pathname) &&
    !isPublicPathname(location.pathname)
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  // Church exists but user is on onboarding → send them to the dashboard
  if (!needsOnboarding && isAuthenticated && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/join-church" element={<JoinChurchPage />} />
        <Route path="/setup" element={<ChurchSetupPage />} />
        <Route path="/login/*" element={<Login />} />
        <Route path="/register/*" element={<Register />} />
        <Route path="/request-access" element={<RequestAccessPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/portal" element={<MemberPortal />} />
          <Route path="/members" element={<Members />} />
          <Route path="/giving" element={<GivingPage />} />
          <Route path="/expenditures" element={<ExpenditurePage />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/sermons" element={<SermonsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/reports" element={<FinancialReportsPage />} />
          <Route path="/attendance-analytics" element={<AttendanceAnalyticsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/church-settings" element={<ChurchSettingsPage />} />
          <Route path="/profile" element={<UserProfilePage />} />
          <Route path="/access-requests" element={<AccessRequestsAdminPage />} />
          <Route path="/dept-dashboard" element={<DepartmentDashboard />} />
          <Route path="/small-groups" element={<SmallGroupsPage />} />
          <Route path="/pastoral-care" element={<PastoralCarePage />} />
          <Route path="/volunteers" element={<VolunteerPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      {isAuthenticated && <AIAssistant />}
      {isAuthenticated && <WhatsNewModal />}
    </>
  );
};

// ── Electron (local/offline) app ─────────────────────────────────────────────

const ELECTRON_NAV_ROUTES = (
  <Routes>
    <Route path="/local-login" element={<LocalLoginPage />} />
    <Route path="/local-setup" element={<LocalSetupPage />} />
    <Route path="/setup" element={<ChurchSetupPage />} />
    <Route element={<Layout />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/portal" element={<MemberPortal />} />
      <Route path="/members" element={<Members />} />
      <Route path="/giving" element={<GivingPage />} />
      <Route path="/expenditures" element={<ExpenditurePage />} />
      <Route path="/properties" element={<PropertiesPage />} />
      <Route path="/departments" element={<DepartmentsPage />} />
      <Route path="/sermons" element={<SermonsPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/attendance" element={<AttendancePage />} />
      <Route path="/reports" element={<FinancialReportsPage />} />
      <Route path="/attendance-analytics" element={<AttendanceAnalyticsPage />} />
      <Route path="/church-settings" element={<ChurchSettingsPage />} />
      <Route path="/access-requests" element={<AccessRequestsAdminPage />} />
      <Route path="/dept-dashboard" element={<DepartmentDashboard />} />
      <Route path="/small-groups" element={<SmallGroupsPage />} />
      <Route path="/pastoral-care" element={<PastoralCarePage />} />
      <Route path="/volunteers" element={<VolunteerPage />} />
      <Route path="/announcements" element={<AnnouncementsPage />} />
    </Route>
    <Route path="*" element={<PageNotFound />} />
  </Routes>
);

function ElectronApp() {
  const { isAuthenticated, isLoadingAuth, hasSetup } = useLocalAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // First-run: no local users exist yet
  if (!hasSetup && location.pathname !== '/local-setup') {
    return <Navigate to="/local-setup" replace />;
  }

  // Not logged in
  if (!isAuthenticated && !['/local-login', '/local-setup'].includes(location.pathname)) {
    return <Navigate to="/local-login" replace />;
  }

  return (
    <>
      {ELECTRON_NAV_ROUTES}
      {isAuthenticated && <AIAssistant />}
      {isAuthenticated && <WhatsNewModal />}
    </>
  );
}

// ── Cloud app (Vercel / browser) ──────────────────────────────────────────────

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function App() {
  // Electron (local) mode
  if (IS_ELECTRON) {
    return (
      <ElectronAuthProvider>
        <ElectronAuthBridge>
          <ChurchSettingsProvider>
            <QueryClientProvider client={queryClientInstance}>
              <Router>
                <ElectronApp />
                <UpdateNotifier />
              </Router>
              <Toaster />
            </QueryClientProvider>
          </ChurchSettingsProvider>
        </ElectronAuthBridge>
      </ElectronAuthProvider>
    );
  }

  if (!CLERK_KEY) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-foreground">Configuration missing</h1>
          <p className="text-muted-foreground text-sm">
            <code className="bg-muted px-1 py-0.5 rounded text-xs">VITE_CLERK_PUBLISHABLE_KEY</code> is not set.
            Add it to your Vercel project environment variables and redeploy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <AuthProvider>
        <ChurchSettingsProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <AuthenticatedApp />
            </Router>
            <Toaster />
          </QueryClientProvider>
        </ChurchSettingsProvider>
      </AuthProvider>
    </ClerkProvider>
  )
}

export default App
