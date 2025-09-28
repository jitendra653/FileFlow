
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import UserActivityLog from './UserActivityLog';
import api from '../../utils/api';
import BulkActionBar from './BulkActionBar';
import TwoFactorToggle from './TwoFactorToggle';

// Helper to convert array of objects to CSV string
function toCSV(rows: any[], columns: string[]): string {
  const escape = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const header = columns.map(escape).join(',');
  const data = rows.map(row => columns.map(col => escape(row[col])).join(',')).join('\n');
  return header + '\n' + data;
}

function showToast(message: string, type: 'success' | 'error' = 'success') {
  alert((type === 'error' ? 'Error: ' : '') + message);
}


interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  quota: number;
  createdAt: string;
  tags?: string[];
  twoFactorEnabled?: boolean;
}

const AdminUserTable = () => {
  const [users, setUsers] = useState([] as User[]);
  const [editRow, setEditRow] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<User>>({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
    const [tagFilter, setTagFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [quotaMin, setQuotaMin] = useState('');
  const [quotaMax, setQuotaMax] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [activityUserId, setActivityUserId] = useState(null as string | null);
  const [selected, setSelected] = useState([] as string[]);

  // Tag editing state
  const [tagEditRow, setTagEditRow] = useState<string | null>(null);
  const [tagEditTags, setTagEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const startTagEdit = (user: User) => {
    setTagEditRow(user.id);
    setTagEditTags(user.tags || []);
    setTagInput('');
  };
  const cancelTagEdit = () => {
    setTagEditRow(null);
    setTagEditTags([]);
    setTagInput('');
  };
  const addTag = () => {
    if (tagInput && !tagEditTags.includes(tagInput)) setTagEditTags([...tagEditTags, tagInput]);
    setTagInput('');
  };
  const removeTag = (tag: string) => setTagEditTags(tags => tags.filter(t => t !== tag));
  const saveTags = async (userId: string) => {
    try {
      await api.patch(`/v1/admin/users/${userId}`, { tags: tagEditTags });
      showToast('Tags updated');
      cancelTagEdit();
      fetchUsers();
    } catch {
      showToast('Could not update tags', 'error');
    }
  };
useEffect(() => {
console.log({activityUserId});

},[activityUserId])
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/admin/users');
      setUsers(res.data.users || []);
    } catch (err) {
      showToast('Could not load users', 'error');
    } finally {
      setLoading(false);
    }
  };

//   const filteredUsers = users.filter(
//     (u: User) =>
//       u.email.toLowerCase().includes(search.toLowerCase()) ||
//       u.name.toLowerCase().includes(search.toLowerCase())
//   );

// Helper to map backend user object to expected frontend structure
const mapUser = (user: any): User & { name: string; quota: string | number; status: string } => {
  let name = user.name;
  if (!name) {
    if (user.firstName || user.lastName) {
      name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    } else if (user.username) {
      name = user.username;
    } else if (user.email) {
      name = user.email;
    } else {
      name = '-';
    }
  }
  let quota = user.quota;
  if (typeof quota === 'object' && quota !== null) {
    quota = quota.limit || quota.value || JSON.stringify(quota);
  }
  if (quota === undefined) quota = 'N/A';
  let status = user.status || user.active || user.enabled;
  if (typeof status === 'boolean') status = status ? 'Active' : 'Inactive';
  if (!status) status = 'N/A';
  return {
    ...user,
    name,
    quota,
    status,
  };
};

  // Map users to expected structure before filtering
  const mappedUsers = users.map(mapUser);
  const allTags = Array.from(new Set(mappedUsers.flatMap(u => u.tags || [])));
  const filteredUsers = mappedUsers.filter((u: User) => {
    // Global search (name/email)
    const matchesSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name ? u.name.toLowerCase().includes(search.toLowerCase()) : false);
    // Role filter
    const matchesRole = !roleFilter || u.role === roleFilter;
    // Status filter
    const matchesStatus = !statusFilter || u.status === statusFilter;
    // Tag filter
    const matchesTag = !tagFilter || (u.tags || []).includes(tagFilter);
    // Quota filter
    const quotaVal = typeof u.quota === 'number' ? u.quota : parseFloat(u.quota as string);
    const matchesQuotaMin = !quotaMin || (!isNaN(quotaVal) && quotaVal >= parseFloat(quotaMin));
    const matchesQuotaMax = !quotaMax || (!isNaN(quotaVal) && quotaVal <= parseFloat(quotaMax));
    // Date range filter
    const created = u.createdAt ? dayjs(u.createdAt) : null;
    const matchesDateFrom = !dateFrom || (created && created.isAfter(dayjs(dateFrom).subtract(1, 'day')));
    const matchesDateTo = !dateTo || (created && created.isBefore(dayjs(dateTo).add(1, 'day')));
    return (
      matchesSearch &&
      matchesRole &&
      matchesStatus &&
      matchesTag &&
      matchesQuotaMin &&
      matchesQuotaMax &&
      matchesDateFrom &&
      matchesDateTo
    );
  });
  // Export filtered users as CSV
  const handleExportCSV = () => {
    if (!filteredUsers.length) {
      showToast('No users to export', 'error');
      return;
    }
    const columns = ['name', 'email', 'role', 'status', 'quota', 'createdAt', 'tags'];
    const rows = filteredUsers.map(u => ({ ...u, tags: (u.tags || []).join(',') }));
    const csv = toCSV(rows, columns);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_export_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSelect = (userId: string) => {
    setSelected((prev: string[]) => prev.includes(userId) ? prev.filter((id: string) => id !== userId) : [...prev, userId]);
  };

  const handleSelectAll = () => {
    if (selected.length === filteredUsers.length) {
      setSelected([]);
    } else {
      setSelected(filteredUsers.map((u: User) => u.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      await api.post('/v1/admin/users/bulk-action', { action: 'delete', userIds: selected });
      showToast('Users deleted');
      setSelected([]);
      fetchUsers();
    } catch {
      showToast('Bulk delete failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSuspend = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      await api.post('/v1/admin/users/bulk-action', { action: 'suspend', userIds: selected });
      showToast('Users suspended');
      setSelected([]);
      fetchUsers();
    } catch {
      showToast('Bulk suspend failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkResetQuota = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      await api.post('/v1/admin/users/bulk-action', { action: 'resetQuota', userIds: selected });
      showToast('Quotas reset');
      setSelected([]);
      fetchUsers();
    } catch {
      showToast('Bulk quota reset failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // API action handlers

  const handleSuspend = async (userId: string) => {
    setLoading(true);
    try {
      await api.patch(`/v1/admin/users/${userId}/status`, { status: 'suspended' });
      showToast('User suspended');
      fetchUsers();
    } catch {
      showToast('Could not suspend user', 'error');
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async (userId: string) => {
    setLoading(true);
    try {
      await api.delete(`/v1/admin/users/${userId}`);
      showToast('User deleted');
      fetchUsers();
    } catch {
      showToast('Could not delete user', 'error');
    } finally {
      setLoading(false);
    }
  };


  const handleResetQuota = async (userId: string) => {
    setLoading(true);
    try {
      await api.patch(`/v1/admin/users/${userId}`, { quota: 0 });
      showToast('Quota reset');
      fetchUsers();
    } catch {
      showToast('Could not reset quota', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Start editing a row
  const handleEdit = (userId: string) => {
    const user = mappedUsers.find(u => u.id === userId);
    setEditRow(userId);
    setEditData({
      name: user?.name || '',
      role: user?.role || '',
      quota: user?.quota || 0,
    });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditRow(null);
    setEditData({});
  };

  // Save edited user
  const handleSaveEdit = async (userId: string) => {
    setLoading(true);
    try {
      await api.patch(`/v1/admin/users/${userId}`, {
        name: editData.name,
        role: editData.role,
        quota: editData.quota,
      });
      showToast('User updated');
      setEditRow(null);
      setEditData({});
      fetchUsers();
    } catch {
      showToast('Could not update user', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row mb-4 gap-2 md:gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="border px-2 py-1 rounded">
            <option value="">All Tags</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search by name or email"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border px-2 py-1 rounded w-48"
          />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="border px-2 py-1 rounded">
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="manager">Manager</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border px-2 py-1 rounded">
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Suspended">Suspended</option>
            <option value="N/A">N/A</option>
          </select>
          <input
            type="number"
            placeholder="Min Quota"
            value={quotaMin}
            onChange={e => setQuotaMin(e.target.value)}
            className="border px-2 py-1 rounded w-24"
          />
          <input
            type="number"
            placeholder="Max Quota"
            value={quotaMax}
            onChange={e => setQuotaMax(e.target.value)}
            className="border px-2 py-1 rounded w-24"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border px-2 py-1 rounded"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border px-2 py-1 rounded"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={fetchUsers} className="px-3 py-1 bg-blue-600 text-white rounded">Refresh</button>
          <button onClick={handleExportCSV} className="px-3 py-1 bg-green-600 text-white rounded">Export CSV</button>
        </div>
      </div>
      <BulkActionBar
        selectedCount={selected.length}
        onDelete={handleBulkDelete}
        onSuspend={handleBulkSuspend}
        onResetQuota={handleBulkResetQuota}
        onClear={() => setSelected([])}
      />
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded shadow">
          <thead>
            <tr>
              <th className="p-2">
                <input type="checkbox" checked={selected.length === filteredUsers.length && filteredUsers.length > 0} onChange={handleSelectAll} />
              </th>
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Status</th>
              <th className="p-2">Quota</th>
              <th className="p-2">Created</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center p-4">Loading...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan={8} className="text-center p-4">No users found.</td></tr>
            ) : (
              filteredUsers.map((user: User) => (
                <tr key={user.id} className="border-t">
                  <td className="p-2">
                    <input type="checkbox" checked={selected.includes(user.id)} onChange={() => handleSelect(user.id)} />
                  </td>
                  {/* Inline editing for name */}
                  <td className="p-2">
                    {editRow === user.id ? (
                      <input
                        type="text"
                        value={editData.name as string}
                        onChange={e => setEditData(ed => ({ ...ed, name: e.target.value }))}
                        className="border px-1 py-0.5 rounded w-24"
                      />
                    ) : (
                      user.name
                    )}
                  </td>
                  <td className="p-2">{user.email}</td>
                  {/* Inline editing for role */}
                  <td className="p-2">
                    {editRow === user.id ? (
                      <select
                        value={editData.role as string}
                        onChange={e => setEditData(ed => ({ ...ed, role: e.target.value }))}
                        className="border px-1 py-0.5 rounded w-20"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                      </select>
                    ) : (
                      user.role
                    )}
                  </td>
                  <td className="p-2">{user.status}</td>
                  {/* Tag display and edit */}
                  <td className="p-2">
                    {tagEditRow === user.id ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        {tagEditTags.map(tag => (
                          <span key={tag} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs flex items-center">
                            {tag}
                            <button className="ml-1 text-xs text-red-500" onClick={() => removeTag(tag)}>&times;</button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addTag()}
                          className="border px-1 py-0.5 rounded w-16 text-xs"
                          placeholder="Add tag"
                        />
                        <button className="text-xs text-green-600 ml-1" onClick={addTag}>Add</button>
                        <button className="text-xs text-blue-600 ml-1" onClick={() => saveTags(user.id)}>Save</button>
                        <button className="text-xs text-gray-500 ml-1" onClick={cancelTagEdit}>Cancel</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1 items-center">
                        {(user.tags || []).map(tag => (
                          <span key={tag} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{tag}</span>
                        ))}
                        <button className="text-xs text-blue-600 ml-1" onClick={() => startTagEdit(user)}>Edit</button>
                      </div>
                    )}
                  </td>
                  {/* Inline editing for quota */}
                  <td className="p-2">
                    {editRow === user.id ? (
                      <input
                        type="number"
                        value={editData.quota as number}
                        onChange={e => setEditData(ed => ({ ...ed, quota: e.target.value }))}
                        className="border px-1 py-0.5 rounded w-16"
                      />
                    ) : (
                      user.quota
                    )}
                  </td>
                  <td className="p-2">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="p-2 space-x-2">
                    {editRow === user.id ? (
                      <>
                        <button className="px-2 py-1 bg-blue-600 text-white rounded text-xs" onClick={() => handleSaveEdit(user.id)}>Save</button>
                        <button className="px-2 py-1 bg-gray-500 text-white rounded text-xs" onClick={handleCancelEdit}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="px-2 py-1 bg-green-500 text-white rounded text-xs" onClick={() => handleEdit(user.id)}>Edit</button>
                        <button className="px-2 py-1 bg-yellow-500 text-white rounded text-xs" onClick={() => handleSuspend(user.id)}>Suspend</button>
                        <button className="px-2 py-1 bg-red-600 text-white rounded text-xs" onClick={() => handleDelete(user.id)}>Delete</button>
                        <button className="px-2 py-1 bg-blue-700 text-white rounded text-xs" onClick={() => handleResetQuota(user.id)}>Reset Quota</button>
                        <button className="px-2 py-1 bg-gray-700 text-white rounded text-xs" onClick={() => setActivityUserId(user.id)}>Activity</button>
                        <TwoFactorToggle userId={user.id} enabled={!!user.twoFactorEnabled} onToggle={() => fetchUsers()} />
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {activityUserId && (
        <UserActivityLog userId={activityUserId} onClose={() => setActivityUserId(null)} />
      )}
    </div>
  );
};

export default AdminUserTable;
