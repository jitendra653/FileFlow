import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

const AdminLogs = () => {
  const [logs, setLogs] = useState([] as LogEntry[]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/v1/admin/logs')
      .then(res => setLogs(res.data))
      .catch(() => setError('Failed to load logs'))
      .finally(() => setLoading(false));
  }, []);

  const filteredLogs = logs.filter(
    (log: LogEntry) =>
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      log.level.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Logs</h2>
      <div className="bg-white p-4 rounded shadow mb-4">
        <input
          type="text"
          placeholder="Search logs..."
          className="border px-2 py-1 rounded w-64 mb-2"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="h-64 overflow-y-auto bg-gray-100 p-2 rounded text-xs">
          {loading ? (
            <div>Loading logs...</div>
          ) : error ? (
            <div className="text-red-600">{error}</div>
          ) : filteredLogs.length === 0 ? (
            <div>No logs found.</div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="p-1 text-left">Time</th>
                  <th className="p-1 text-left">Level</th>
                  <th className="p-1 text-left">Message</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log: LogEntry, idx: number) => (
                  <tr key={idx} className={log.level === 'error' ? 'text-red-700' : log.level === 'warn' ? 'text-yellow-700' : ''}>
                    <td className="p-1 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-1 font-bold uppercase">{log.level}</td>
                    <td className="p-1">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLogs;
