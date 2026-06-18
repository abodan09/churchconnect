import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
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
import AIAssistant from './components/AIAssistant';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <>
      <Routes>
        <Route path="/setup" element={<ChurchSetupPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
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
          <Route path="/church-settings" element={<ChurchSettingsPage />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      {isAuthenticated && <AIAssistant />}
    </>
  );
};

function App() {
  return (
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
  )
}

export default App