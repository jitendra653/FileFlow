import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { adminEvents, fileEvents } from '../utils/socketEvents';
import { useSocket } from '../context/SocketContext';

interface ProcessUpdate {
  processId: string;
  userId: string;
  fileId: string;
  type: 'upload' | 'transform';
  progress: number;
  status: string;
  message?: string;
  error?: string;
  details?: any;
}

interface SystemStats {
  users: {
    total: number;
    active: number;
    suspended: number;
    deleted: number;
    byPlan: {
      free: number;
      basic: number;
      premium: number;
    };
  };
  files: {
    total: number;
    totalStorage: number;
    byType: {
      [key: string]: number;
    };
  };
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    activeConnections: number;
    errorRate: number;
    averageResponseTime: number;
  };
}

interface UserListItem {
  _id: string;
  email: string;
  status: string;
  plan: string;
  quota: {
    apiCallsMade: number;
    apiCallLimit: number;
    storageUsed: number;
    storageLimit: number;
  };
}

const AdminDashboard = () => {
  const { socket } = useSocket();
  const [users, setUsers] = useState([] as UserListItem[]);
  const [selectedUsers, setSelectedUsers] = useState([] as string[]);
  const [userFilters, setUserFilters] = useState({
    search: '',
    status: '',
    plan: '',
    page: 1
  });
  const [loading, setLoading] = useState(false);
  const [activeProcesses, setActiveProcesses] = useState([] as ProcessUpdate[]);
  const [systemStats, setSystemStats] = useState({
    users: {
      total: 0, active: 0, suspended: 0, deleted: 0,
      byPlan: { free: 0, basic: 0, premium: 0 }
    },
    files: { total: 0, totalStorage: 0, byType: {} },
    metrics: {
      cpuUsage: 0, memoryUsage: 0, activeConnections: 0,
      errorRate: 0, averageResponseTime: 0
    }
  } as SystemStats);

  useEffect(() => {
    if (!socket) return;

    socket.on('connect', () => {
      console.log('Connected to admin dashboard');
    });

    // Listen for process updates
    socket.on(fileEvents.UPLOAD_PROGRESS, handleProcessUpdate);
    socket.on(fileEvents.UPLOAD_COMPLETED, handleProcessUpdate);
    socket.on(fileEvents.UPLOAD_FAILED, handleProcessUpdate);
    socket.on(fileEvents.TRANSFORM_PROGRESS, handleProcessUpdate);
    socket.on(fileEvents.TRANSFORM_COMPLETED, handleProcessUpdate);
    socket.on(fileEvents.TRANSFORM_FAILED, handleProcessUpdate);

    // Listen for system stats updates
    socket.on(adminEvents.METRICS_UPDATE, (stats: SystemStats) => {
      setSystemStats(stats);
    });

    return () => {
      if (socket) {
        socket.off(fileEvents.UPLOAD_PROGRESS);
        socket.off(fileEvents.UPLOAD_COMPLETED);
        socket.off(fileEvents.UPLOAD_FAILED);
        socket.off(fileEvents.TRANSFORM_PROGRESS);
        socket.off(fileEvents.TRANSFORM_COMPLETED);
        socket.off(fileEvents.TRANSFORM_FAILED);
        socket.off(adminEvents.METRICS_UPDATE);
      }
    };
  }, []);

  const handleProcessUpdate = (update: ProcessUpdate) => {
    setActiveProcesses((prev: ProcessUpdate[]) => {
      const filtered = prev.filter((p: ProcessUpdate) => p.processId !== update.processId);
      if (update.status === 'completed' || update.status === 'failed') {
        return filtered;
      }
      return [...filtered, update];
    });
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/v1/admin/users?${new URLSearchParams({
        page: userFilters.page.toString(),
        search: userFilters.search,
        status: userFilters.status,
        plan: userFilters.plan
      })}`);
      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAction = async (action: string) => {
    if (!selectedUsers.length) return;
    
    try {
      const response = await fetch('/v1/admin/users/bulk-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userIds: selectedUsers,
          action
        })
      });
      
      if (response.ok) {
        fetchUsers();
        setSelectedUsers([]);
      }
    } catch (error) {
      console.error('Error performing bulk action:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []); // Initial fetch

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="flex space-x-4">
            <button 
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              onClick={() => fetchUsers()}
            >
              Refresh Data
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* System Overview */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">System Overview</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Users</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Total: {systemStats.users.total}</div>
                  <div>Active: {systemStats.users.active}</div>
                  <div>Suspended: {systemStats.users.suspended}</div>
                  <div>Deleted: {systemStats.users.deleted}</div>
                </div>
                <div className="mt-2">
                  <h4 className="text-sm font-medium">By Plan</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>Free: {systemStats.users.byPlan.free}</div>
                    <div>Basic: {systemStats.users.byPlan.basic}</div>
                    <div>Premium: {systemStats.users.byPlan.premium}</div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Storage</h3>
                <div className="text-sm">
                  <div>Total Files: {systemStats.files.total}</div>
                  <div>Storage Used: {formatBytes(systemStats.files.totalStorage)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Performance</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span>CPU Usage</span>
                  <span>{systemStats.metrics.cpuUsage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${systemStats.metrics.cpuUsage}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span>Memory Usage</span>
                  <span>{systemStats.metrics.memoryUsage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${systemStats.metrics.memoryUsage}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span>Error Rate</span>
                  <span>{systemStats.metrics.errorRate.toFixed(2)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${systemStats.metrics.errorRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {selectedUsers.length > 0 ? (
                <>
                  <button 
                    onClick={() => handleBulkAction('suspend')}
                    className="w-full bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
                  >
                    Suspend Selected ({selectedUsers.length})
                  </button>
                  <button 
                    onClick={() => handleBulkAction('activate')}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    Activate Selected
                  </button>
                  <button 
                    onClick={() => setSelectedUsers([])}
                    className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                  >
                    Clear Selection
                  </button>
                </>
              ) : (
                <>
                  <button className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    View Audit Logs
                  </button>
                  <button className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                    System Settings
                  </button>
                  <button className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
                    Generate Report
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* User Management */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">User Management</h2>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-4">
              <input
                type="text"
                placeholder="Search users..."
                className="border rounded px-3 py-2 w-64"
                value={userFilters.search}
                onChange={e => setUserFilters(prev => ({ ...prev, search: e.target.value }))}
              />
              <select
                className="border rounded px-3 py-2"
                value={userFilters.status}
                onChange={e => setUserFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
              <select
                className="border rounded px-3 py-2"
                value={userFilters.plan}
                onChange={e => setUserFilters(prev => ({ ...prev, plan: e.target.value }))}
              >
                <option value="">All Plans</option>
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
              </select>
              <button
                onClick={() => fetchUsers()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedUsers.length === users.length}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedUsers(users.map(u => u._id));
                          } else {
                            setSelectedUsers([]);
                          }
                        }}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      API Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Storage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map(user => (
                    <tr key={user._id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user._id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedUsers(prev => [...prev, user._id]);
                            } else {
                              setSelectedUsers(prev => prev.filter(id => id !== user._id));
                            }
                          }}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs ${
                          user.status === 'active' ? 'bg-green-100 text-green-800' :
                          user.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs ${
                          user.plan === 'premium' ? 'bg-purple-100 text-purple-800' :
                          user.plan === 'basic' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          {user.quota.apiCallsMade} / {user.quota.apiCallLimit}
                          <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1">
                            <div 
                              className="bg-blue-600 h-1.5 rounded-full"
                              style={{ width: `${(user.quota.apiCallsMade / user.quota.apiCallLimit) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          {formatBytes(user.quota.storageUsed)} / {formatBytes(user.quota.storageLimit)}
                          <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1">
                            <div 
                              className="bg-green-600 h-1.5 rounded-full"
                              style={{ width: `${(user.quota.storageUsed / user.quota.storageLimit) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button className="text-blue-600 hover:text-blue-900">View Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

          {/* Active Processes */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Active Processes</h2>
            <div className="space-y-4">
              {activeProcesses.map(process => (
                <div key={process.processId} className="border-b pb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">
                      {process.type.toUpperCase()} - User: {process.userId}
                    </span>
                    <span className={`px-2 py-1 rounded text-sm ${
                      process.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      process.status === 'completed' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {process.status}
                    </span>
                  </div>
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold inline-block text-blue-600">
                          {process.message || `Progress: ${process.progress}%`}
                        </span>
                      </div>
                    </div>
                    <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                      <div 
                        style={{ width: `${process.progress}%` }}
                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-300"
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
              {activeProcesses.length === 0 && (
                <div className="text-gray-500 text-center py-4">
                  No active processes
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;