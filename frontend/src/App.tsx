import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Notifications from './components/Notifications';
import AdminSecurityDashboard from './components/AdminSecurityDashboard';
import AdvancedGallery from './components/AdvancedGallery';
import Home from './components/Home';
import Register from './components/Register';
import Navbar from './components/Navbar';
import Plans from './components/Plans';
import PaymentResult from './components/PaymentResult';
import Settings from './components/Settings';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('authToken'));

  useEffect(() => {
    // Check for existing token in localStorage
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const handleLogin = (newToken: string) => {
    localStorage.setItem('authToken', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
  };

  if (!token) {
    return (
      <>
        <Navbar />
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
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
      <SocketProvider token={token}>
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
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Logout
                </button>
              </div>
            </div>
          </nav>

          <div className="max-w-7xl mx-auto py-6 px-4">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/admin/security" element={<AdminSecurityDashboard />} />
              <Route path="/gallery" element={<AdvancedGallery />} />
              <Route path="/plans" element={<Plans />} />
              <Route path="/payment-success" element={<PaymentResult />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>

          <Notifications />
        </div>
      </SocketProvider>
    </Router>
  );
}
