import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, SignIn } from '@clerk/clerk-react';
import { setToken } from './lib/api';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ChurchesPage from './pages/ChurchesPage';

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-8 h-8 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [adminStatus, setAdminStatus] = useState('checking'); // 'checking' | 'ok' | 'denied'

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setAdminStatus('denied'); return; }

    getToken().then(token => {
      setToken(token);
      return fetch('/api/stats', { headers: { Authorization: `Bearer ${token}` } });
    }).then(r => {
      setAdminStatus(r.ok ? 'ok' : 'denied');
    }).catch(() => setAdminStatus('denied'));
  }, [isLoaded, isSignedIn]);

  // Keep token fresh
  useEffect(() => {
    if (!isSignedIn) return;
    const id = setInterval(() => {
      getToken().then(setToken).catch(() => {});
    }, 55 * 60 * 1000); // refresh every 55 min
    return () => clearInterval(id);
  }, [isSignedIn]);

  if (!isLoaded || (isSignedIn && adminStatus === 'checking')) return <Spinner />;

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-4">
              <span className="text-white text-xl font-bold">✝</span>
            </div>
            <h1 className="text-white text-2xl font-bold">Platform Admin</h1>
            <p className="text-slate-400 text-sm mt-1">ChurchConnect · Management Console</p>
          </div>
          <SignIn routing="hash" />
        </div>
      </div>
    );
  }

  if (adminStatus === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⛔</span>
          </div>
          <h1 className="text-xl font-bold">Access Denied</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Your account is not listed as a platform administrator.<br />
            Add your Clerk user ID to <code className="text-indigo-400">PLATFORM_ADMIN_CLERK_IDS</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/churches" element={<ChurchesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}
