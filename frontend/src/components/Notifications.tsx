import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  timestamp: number;
}

export default function Notifications() {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([] as Notification[]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!socket) return;

    const handleFileUploadSuccess = (data: { fileName: string }) => {
      addNotification({
        id: Date.now().toString(),
        type: 'success',
        message: `File "${data.fileName}" uploaded successfully`,
        timestamp: Date.now(),
      });
    };

    const handleFileProcessing = (data: { fileName: string; status: string }) => {
      addNotification({
        id: Date.now().toString(),
        type: 'info',
        message: `File "${data.fileName}" is ${data.status}`,
        timestamp: Date.now(),
      });
    };

    const handleTransformationComplete = (data: { fileName: string }) => {
      addNotification({
        id: Date.now().toString(),
        type: 'success',
        message: `Transformation completed for "${data.fileName}"`,
        timestamp: Date.now(),
      });
    };

    const handleError = (data: { message: string }) => {
      addNotification({
        id: Date.now().toString(),
        type: 'error',
        message: data.message,
        timestamp: Date.now(),
      });
    };

    socket.on('file_upload_success', handleFileUploadSuccess);
    socket.on('file_processing', handleFileProcessing);
    socket.on('transformation_complete', handleTransformationComplete);
    socket.on('error', handleError);

    return () => {
      socket.off('file_upload_success', handleFileUploadSuccess);
      socket.off('file_processing', handleFileProcessing);
      socket.off('transformation_complete', handleTransformationComplete);
      socket.off('error', handleError);
    };
  }, [socket]);

  const addNotification = (notification: Notification) => {
    setNotifications((prev: Notification[]) => [notification, ...prev].slice(0, 5));
  };

  const removeNotification = (id: string) => {
    setNotifications((prev: Notification[]) => prev.filter((n: Notification) => n.id !== id));
  };

  if (!isVisible || notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <div className="flex items-center justify-between bg-white p-2 rounded-t-lg shadow">
        <span className="font-semibold">Notifications</span>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ×
        </button>
      </div>
      {notifications.map(({ id, type, message, timestamp }: Notification) => (
        <div
          key={id}
          className={`flex items-start p-4 rounded-lg shadow-lg transition-all duration-300 ${
            type === 'success' ? 'bg-green-50 text-green-800' :
            type === 'error' ? 'bg-red-50 text-red-800' :
            type === 'warning' ? 'bg-yellow-50 text-yellow-800' :
            'bg-blue-50 text-blue-800'
          }`}
        >
          <div className="flex-grow">
            <p className="font-medium">{message}</p>
            <p className="text-sm opacity-75">
              {new Date(timestamp).toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={() => removeNotification(id)}
            className="ml-4 text-current opacity-75 hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}