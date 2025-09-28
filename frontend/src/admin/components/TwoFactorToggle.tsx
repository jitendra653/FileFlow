
import { useState } from 'react';
import api from '../../utils/api';

function showToast(message: string, type: 'success' | 'error' = 'success') {
  alert((type === 'error' ? 'Error: ' : '') + message);
}

interface TwoFactorToggleProps {
  userId: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const TwoFactorToggle: React.FC<TwoFactorToggleProps> = ({ userId, enabled, onToggle }) => {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (!isEnabled) {
        await api.post('/v1/2fa/enable');
        showToast('2FA enabled');
      } else {
        await api.post('/v1/2fa/disable');
        showToast('2FA disabled');
      }
      setIsEnabled(!isEnabled);
      onToggle(!isEnabled);
    } catch {
      showToast('Could not update 2FA', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`px-2 py-1 rounded text-xs ${isEnabled ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-700'}`}
    >
      {isEnabled ? '2FA Enabled' : 'Enable 2FA'}
    </button>
  );
};

export default TwoFactorToggle;
