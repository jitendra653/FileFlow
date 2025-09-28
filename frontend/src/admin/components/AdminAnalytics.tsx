import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  filesUploaded: number;
  storageUsed: number;
  dailyActive: { date: string; count: number }[];
}

const AdminAnalytics = () => {
  const [data, setData] = useState(null as AnalyticsData | null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/v1/admin/analytics')
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4">Loading analytics...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="bg-white rounded shadow p-6 mb-6">
      <h2 className="text-xl font-bold mb-4">Platform Analytics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-100 p-4 rounded">
          <div className="text-2xl font-bold">{data.totalUsers}</div>
          <div className="text-gray-600">Total Users</div>
        </div>
        <div className="bg-green-100 p-4 rounded">
          <div className="text-2xl font-bold">{data.activeUsers}</div>
          <div className="text-gray-600">Active Users</div>
        </div>
        <div className="bg-purple-100 p-4 rounded">
          <div className="text-2xl font-bold">{data.filesUploaded}</div>
          <div className="text-gray-600">Files Uploaded</div>
        </div>
        <div className="bg-yellow-100 p-4 rounded">
          <div className="text-2xl font-bold">{(data.storageUsed / 1024).toFixed(2)} GB</div>
          <div className="text-gray-600">Storage Used</div>
        </div>
      </div>
      <h3 className="font-semibold mb-2">Daily Active Users</h3>
      <div className="w-full h-64 bg-gray-50 rounded p-2 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.dailyActive} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AdminAnalytics;
