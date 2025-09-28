import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

interface Notification {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotifications();
    // Optionally, poll for new notifications every 30s
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/admin/notifications');
      setNotifications(res.data.notifications || []);
    } catch {
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/v1/admin/notifications/${id}/read`);
      setNotifications(notifications => notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
  };

  return (
    <div className="bg-white rounded shadow p-4 mb-4 max-w-md">
      <h3 className="font-semibold mb-2">Notifications</h3>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : notifications.length === 0 ? (
        <div>No notifications.</div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {notifications.map(n => (
            <li key={n.id} className={`py-2 flex items-start ${n.read ? 'opacity-60' : ''}`}>
              <span className={`mr-2 w-2 h-2 rounded-full mt-2 ${n.read ? 'bg-gray-300' : 'bg-blue-500'}`}></span>
              <div className="flex-1">
                <div className="text-xs text-gray-500">{new Date(n.timestamp).toLocaleString()}</div>
                <div className="text-sm">{n.message}</div>
              </div>
              {!n.read && (
                <button className="ml-2 text-xs text-blue-600 underline" onClick={() => markAsRead(n.id)}>Mark as read</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NotificationCenter;
