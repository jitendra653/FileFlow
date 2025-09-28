
import { useState } from 'react';
import api from '../../utils/api';

function showToast(message: string, type: 'success' | 'error' = 'success') {
  alert((type === 'error' ? 'Error: ' : '') + message);
}

interface RoleManagementProps {
  userId: string;
  currentRole: string;
  onRoleChange: (role: string) => void;
}

const roles = ['user', 'admin', 'superadmin'];

const RoleManagement: React.FC<RoleManagementProps> = ({ userId, currentRole, onRoleChange }) => {
  const [role, setRole] = useState(currentRole);
  const [loading, setLoading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    setRole(newRole);
    setLoading(true);
    try {
      await api.patch(`/v1/admin/users/${userId}/role`, { role: newRole });
      showToast('Role updated');
      onRoleChange(newRole);
    } catch {
      showToast('Could not update role', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <select value={role} onChange={handleChange} disabled={loading} className="border rounded px-2 py-1">
      {roles.map(r => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );
};

export default RoleManagement;
