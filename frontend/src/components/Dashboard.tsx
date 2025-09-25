import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

interface ProcessStatusUpdate {
  processId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message: string;
  progress?: number;
  error?: string;
}

interface Stats {
  storageUsed: number;
  storageLimit: number;
  apiCallsMade: number;
  apiCallLimit: number;
  popularCategories: string[];
}

export default function Dashboard() {
  const { socket, isConnected } = useSocket();
  const [stats, setStats] = useState({
    storageUsed: 0,
    storageLimit: 0,
    apiCallsMade: 0,
    apiCallLimit: 0,
    popularCategories: [],
  });
  const [activeProcesses, setActiveProcesses] = useState([] as ProcessStatusUpdate[]);

  useEffect(() => {
    if (!socket) return;

    // Subscribe to analytics updates
    socket.on('analytics_update', (data: Stats) => {
      setStats(data);
    });

    // Subscribe to process status updates
    socket.on('process_status', (update: ProcessStatusUpdate) => {
      setActiveProcesses((prev: ProcessStatusUpdate[]) => {
        const filtered = prev.filter((p: ProcessStatusUpdate) => p.processId !== update.processId);
        if (update.status === 'completed' || update.status === 'error') {
          return filtered;
        }
        return [...filtered, update];
      });
    });

    // Initial data fetch
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/v1/analytics`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      },
    })
      .then((response) => response.json())
      .then((data) => setStats(data))
      .catch((error) => console.error('Error fetching analytics:', error));

    return () => {
      socket.off('analytics_update');
      socket.off('process_status');
    };
  }, [socket]);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center">
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
        <div className={`ml-4 inline-flex items-center ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
          <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}></div>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white shadow-lg rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Storage Usage</h2>
          <div className="flex flex-col">
            <div className="mb-2">
              <div className="flex justify-between mb-1">
                <span>{stats.storageUsed} MB used</span>
                <span>{Math.round((stats.storageUsed / stats.storageLimit) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${(stats.storageUsed / stats.storageLimit) * 100}%` }}
                ></div>
              </div>
            </div>
            <p className="text-gray-600 text-sm">Limit: {stats.storageLimit} MB</p>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">API Usage</h2>
          <div className="flex flex-col">
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span>{stats.apiCallsMade} calls</span>
                <span>{Math.round((stats.apiCallsMade / stats.apiCallLimit) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${(stats.apiCallsMade / stats.apiCallLimit) * 100}%` }}
                ></div>
              </div>
              <p className="text-gray-600 text-sm mt-1">Limit: {stats.apiCallLimit} calls</p>
            </div>

            {stats.apiUsage && (
              <>
                <div className="mb-4">
                  <h3 className="text-md font-medium mb-2">Last 7 Days Usage</h3>
                  <div className="space-y-2">
                    {stats.apiUsage.history.map((day: any) => (
                      <div key={day.date} className="flex justify-between text-sm">
                        <span>{new Date(day.date).toLocaleDateString()}</span>
                        <span>{day.calls} calls</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-2">
                  <h3 className="text-md font-medium mb-2">Popular Endpoints</h3>
                  <div className="space-y-2">
                    {stats.apiUsage.popularEndpoints.map((endpoint: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="truncate flex-1">{endpoint.endpoint}</span>
                        <span className="ml-2">{endpoint.count} calls</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-sm text-gray-600 mt-2">
                  Next Reset: {new Date(stats.apiUsage.nextReset).toLocaleDateString()}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Popular Categories</h2>
          <div className="space-y-2">
            {stats.popularCategories?.map((category: string, index: number) => (
              <div key={index} className="flex items-center">
                <span className="w-4 h-4 rounded-full bg-indigo-600 mr-3"></span>
                <span>{category?.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {activeProcesses.length > 0 && (
        <div className="bg-white shadow-lg rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Active Processes</h2>
          <div className="space-y-4">
            {activeProcesses.map((process: ProcessStatusUpdate) => (
              <div key={process.processId} className="border rounded p-4">
                <div className="flex justify-between mb-2">
                  <span className="font-medium">{process.message}</span>
                  <span className={`capitalize ${
                    process.status === 'processing' ? 'text-blue-600' :
                    process.status === 'completed' ? 'text-green-600' :
                    process.status === 'error' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>{process.status}</span>
                </div>
                {typeof process.progress === 'number' && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${process.progress}%` }}
                    ></div>
                  </div>
                )}
                {process.error && (
                  <p className="text-red-600 text-sm mt-2">{process.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
