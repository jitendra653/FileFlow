import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import AdminLayout from './admin/components/AdminLayout';
import AdminUsers from './admin/views/AdminUsers';
import AdminAnalytics from './admin/views/AdminAnalytics';
import AdminLogs from './admin/views/AdminLogs';
import AdminSecurity from './admin/views/AdminSecurity';
import { SocketProvider } from './context/SocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Notifications from './components/Notifications';
import AdminAuditAndNotifications from './admin/views/AdminAuditAndNotifications';
import AdminWebhooks from './admin/views/AdminWebhooks';
import AdvancedGallery from './components/AdvancedGallery';
import Home from './components/Home';
import Register from './components/Register';
import Navbar from './components/Navbar';
import Plans from './components/Plans';
import PaymentResult from './components/PaymentResult';
import Settings from './components/Settings';
import AdminScheduledTasks from './admin/views/AdminScheduledTasks';
import AdminFiles from './admin/views/AdminFiles';
import ErrorBoundary from './components/ErrorBoundary';
import AdminDashboard from './components/AdminDashboard';


function AppRoutes() {
  const { user, loading, logout } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return (
      <>
        <Navbar />
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/payment-success" element={<PaymentResult />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </>
    );
  }

  return (
    <Router>
      <SocketProvider token={user.id}>
        <div className="min-h-screen bg-gray-100">
          <nav className="bg-white shadow p-4">
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-center">
                <div className="flex space-x-4">
                  <h1 className="text-xl font-bold">FileFlow Analytics Dashboard</h1>
                  <Link to="/" className="px-3 py-2 rounded-md hover:bg-gray-100">
                    Dashboard
                  </Link>
                  <Link to="/admin/security" className="px-3 py-2 rounded-md hover:bg-gray-100">
                    Security
                  </Link>
                  <Link to="/gallery" className="px-3 py-2 rounded-md hover:bg-gray-100">
                    Gallery
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Logout
                </button>
              </div>
            </div>
          </nav>
          <AdminDashboard />
          <div className="max-w-7xl mx-auto py-6 px-4">
            {/* <ErrorBoundary> */}
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/gallery" element={<AdvancedGallery />} />
                <Route path="/plans" element={<Plans />} />
                <Route path="/payment-success" element={<PaymentResult />} />
                <Route path="/settings" element={<Settings />} />
                {/* Admin Panel Nested Routes */}
                <Route path="/admin" element={<AdminLayout />}>
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="analytics" element={<AdminAnalytics />} />
                  <Route path="logs" element={<AdminLogs />} />
                  <Route path="security" element={<AdminSecurity />} />
                  <Route path="scheduled-tasks" element={<AdminScheduledTasks />} />
                  <Route path='files' element={<AdminFiles />} />
                  <Route path="audit" element={<AdminAuditAndNotifications />} />
                  <Route path="webhooks" element={<AdminWebhooks />} />
                </Route>
              </Routes>
            {/* </ErrorBoundary> */}
          </div>

          <Notifications />
        </div>
      </SocketProvider>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
