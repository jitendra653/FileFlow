

import { Outlet, NavLink, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../../utils/api';


const AdminLayout = () => {
  // Simulate getting user info from localStorage or context
  const [isAdmin, setIsAdmin] = useState(null);


  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await api.get('/v1/auth/me');
        setIsAdmin(res.data.user.role === 'admin' || res.data.user.role === 'superadmin');
      } catch {
        setIsAdmin(false);
      }
    };
    refresh();
  }, []);



  if (isAdmin === null) return null; // or loading spinner
  if (!isAdmin) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow p-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <nav className="space-x-4">
          <NavLink to="/admin/users" className={({isActive}: {isActive: boolean}) => isActive ? 'text-blue-600 font-semibold' : 'text-gray-700'}>Users</NavLink>
          <NavLink to="/admin/files" className={({isActive}: {isActive: boolean}) => isActive ? 'text-blue-600 font-semibold' : 'text-gray-700'}>Files</NavLink>
          <NavLink to="/admin/analytics" className={({isActive}: {isActive: boolean}) => isActive ? 'text-blue-600 font-semibold' : 'text-gray-700'}>Analytics</NavLink>
          <NavLink to="/admin/logs" className={({isActive}: {isActive: boolean}) => isActive ? 'text-blue-600 font-semibold' : 'text-gray-700'}>Logs</NavLink>
          <NavLink to="/admin/security" className={({isActive}: {isActive: boolean}) => isActive ? 'text-blue-600 font-semibold' : 'text-gray-700'}>Security</NavLink>
          <NavLink to="/admin/scheduled-tasks" className={({isActive}: {isActive: boolean}) => isActive ? 'text-blue-600 font-semibold' : 'text-gray-700'}>Scheduled Tasks</NavLink>
          <NavLink to="/admin/audit" className={({isActive}: {isActive: boolean}) => isActive ? 'text-blue-600 font-semibold' : 'text-gray-700'}>Audit & Notifications</NavLink>
          <NavLink to="/admin/webhooks" className={({isActive}: {isActive: boolean}) => isActive ? 'text-blue-600 font-semibold' : 'text-gray-700'}>Webhooks</NavLink>
        </nav>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
