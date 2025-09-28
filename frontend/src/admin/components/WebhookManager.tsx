
import { useState } from 'react';
import api from '../../utils/api';

function showToast(message: string, type: 'success' | 'error' = 'success') {
  alert((type === 'error' ? 'Error: ' : '') + message);
}

interface WebhookManagerProps {
  userId: string;
  webhooks: string[];
  onUpdate: (webhooks: string[]) => void;
}

const WebhookManager: React.FC<WebhookManagerProps> = ({ userId, webhooks, onUpdate }) => {
  const [newWebhook, setNewWebhook] = useState('');
  const [list, setList] = useState(webhooks);

  const addWebhook = async () => {
    if (newWebhook && !list.includes(newWebhook)) {
      try {
        // Example API call, update endpoint as needed
        await api.post('/v1/user/webhook/paypal', { url: newWebhook });
        const updated = [...list, newWebhook];
        setList(updated);
        onUpdate(updated);
        setNewWebhook('');
        showToast('Webhook added');
      } catch {
        showToast('Could not add webhook', 'error');
      }
    }
  };

  const removeWebhook = async (url: string) => {
    try {
      // Example API call, update endpoint as needed
      await api.delete('/v1/user/webhook/paypal', { data: { url } });
      const updated = list.filter((w: string) => w !== url);
      setList(updated);
      onUpdate(updated);
      showToast('Webhook removed');
    } catch {
      showToast('Could not remove webhook', 'error');
    }
  };

  return (
    <div>
      <div className="flex mb-2">
        <input
          type="url"
          placeholder="Webhook URL"
          value={newWebhook}
          onChange={e => setNewWebhook(e.target.value)}
          className="border px-2 py-1 rounded w-64"
        />
        <button onClick={addWebhook} className="ml-2 px-3 py-1 bg-blue-600 text-white rounded">Add</button>
      </div>
      <ul className="list-disc pl-5">
        {list.map((url: string) => (
          <li key={url} className="flex items-center justify-between">
            <span>{url}</span>
            <button onClick={() => removeWebhook(url)} className="ml-2 px-2 py-1 bg-red-600 text-white rounded text-xs">Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default WebhookManager;
