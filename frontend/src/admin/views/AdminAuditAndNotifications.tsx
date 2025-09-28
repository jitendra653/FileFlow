import React from 'react';
import NotificationCenter from '../components/NotificationCenter';
import AdminLogs from '../components/AdminLogs';

const AdminAuditAndNotifications = () => {
  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="flex-1">
        <NotificationCenter />
      </div>
      <div className="flex-1">
        <AdminLogs />
      </div>
    </div>
  );
};

export default AdminAuditAndNotifications;
