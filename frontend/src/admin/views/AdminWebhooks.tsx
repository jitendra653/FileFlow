import { useEffect, useState } from 'react';
import api from '../../utils/api';
import WebhookManager from '../components/WebhookManager';

const AdminWebhooks = () => {
  const [userId, setUserId] = useState('');
  const [webhooks, setWebhooks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Example: fetch current admin's webhooks, or allow selection of user
    setLoading(true);
    api.get('/v1/user/webhook/paypal')
      .then(res => {
        setUserId(res.data.userId || '');
        setWebhooks(res.data.webhooks || []);
      })
      .catch(() => setError('Could not load webhooks'))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = (updated: string[]) => {
    setWebhooks(updated);
  };

  if (loading) return <div className="p-4">Loading webhooks...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="bg-white rounded shadow p-6 mb-6">
      <h2 className="text-xl font-bold mb-4">Webhook Management</h2>
      <WebhookManager userId={userId} webhooks={webhooks} onUpdate={handleUpdate} />
    </div>
  );
};

export default AdminWebhooks;
