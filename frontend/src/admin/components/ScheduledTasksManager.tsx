import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

interface ScheduledTask {
  id: string;
  name: string;
  type: string;
  schedule: string;
  status: string;
  lastRun: string;
  nextRun: string;
}

const ScheduledTasksManager = () => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', type: '', schedule: '' });

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/admin/scheduled-tasks');
      setTasks(res.data.tasks || []);
    } catch {
      setError('Failed to load scheduled tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/v1/admin/scheduled-tasks', newTask);
      setShowCreate(false);
      setNewTask({ name: '', type: '', schedule: '' });
      fetchTasks();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/v1/admin/scheduled-tasks/${id}`);
      fetchTasks();
    } catch {}
  };

  return (
    <div className="bg-white rounded shadow p-6 mb-6">
      <h2 className="text-xl font-bold mb-4">Scheduled Tasks</h2>
      <button className="mb-4 px-3 py-1 bg-blue-600 text-white rounded" onClick={() => setShowCreate(!showCreate)}>
        {showCreate ? 'Cancel' : 'Create New Task'}
      </button>
      {showCreate && (
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Task Name"
            value={newTask.name}
            onChange={e => setNewTask(t => ({ ...t, name: e.target.value }))}
            className="border px-2 py-1 rounded"
          />
          <input
            type="text"
            placeholder="Type (e.g. quotaReset)"
            value={newTask.type}
            onChange={e => setNewTask(t => ({ ...t, type: e.target.value }))}
            className="border px-2 py-1 rounded"
          />
          <input
            type="text"
            placeholder="Schedule (cron)"
            value={newTask.schedule}
            onChange={e => setNewTask(t => ({ ...t, schedule: e.target.value }))}
            className="border px-2 py-1 rounded"
          />
          <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={handleCreate}>Create</button>
        </div>
      )}
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : tasks.length === 0 ? (
        <div>No scheduled tasks found.</div>
      ) : (
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Schedule</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Last Run</th>
              <th className="p-2 text-left">Next Run</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <tr key={task.id}>
                <td className="p-2">{task.name}</td>
                <td className="p-2">{task.type}</td>
                <td className="p-2">{task.schedule}</td>
                <td className="p-2">{task.status}</td>
                <td className="p-2">{task.lastRun ? new Date(task.lastRun).toLocaleString() : '-'}</td>
                <td className="p-2">{task.nextRun ? new Date(task.nextRun).toLocaleString() : '-'}</td>
                <td className="p-2">
                  <button className="px-2 py-1 bg-red-600 text-white rounded text-xs" onClick={() => handleDelete(task.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ScheduledTasksManager;
