
import { useEffect, useState } from 'react';
import api from '../../utils/api';

interface ActivityLog {
  timestamp: string;
  action: string;
  details: string;
}

interface UserActivityProps {
  userId: string;
  onClose: () => void;
}

const UserActivityLog: React.FC<UserActivityProps> = ({ userId, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line
  }, [userId]);

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/v1/admin/users/${userId}/activity`);
      setLogs(res.data.logs || []);
    } catch {
      setError('Could not load activity logs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-2xl relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-black">&times;</button>
        <h2 className="text-xl font-semibold mb-4">User Activity Log</h2>
        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : logs.length === 0 ? (
          <div>No activity found.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left">Timestamp</th>
                <th className="p-2 text-left">Action</th>
                <th className="p-2 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="p-2">{log.action}</td>
                  <td className="p-2">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default UserActivityLog;
