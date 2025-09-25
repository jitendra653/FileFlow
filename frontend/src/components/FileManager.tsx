import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface FileInfo {
  _id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: string;
  url?: string;
}

const FileManager: React.FC = () => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [transformType, setTransformType] = useState<'resize' | 'rotate' | 'crop' | ''>('');
  const [transformValue, setTransformValue] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await axios.get('/v1/files', {
        baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setFiles(res.data.files || []);
    } catch (err) {
      alert('Error fetching files');
    }
    setLoading(false);
  };

  const handleDelete = async (fileId: string) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await axios.delete(`/v1/files/${fileId}`);
      setFiles(files.filter(f => f._id !== fileId));
    } catch (err) {
      alert('Error deleting file');
    }
  };

  const handleDownload = (file: FileInfo) => {
    window.open(file.url || `/v1/files/${file._id}/download`, '_blank');
  };

  const handleSelect = (file: FileInfo) => {
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setImagePreview(file.url || `/v1/files/${file._id}/download`);
    } else {
      setImagePreview(null);
    }
  };

  const handleTransform = async () => {
    if (!selectedFile || !transformType || !transformValue) return;
    setLoading(true);
    try {
      const res = await axios.post(`/v1/transform/${selectedFile._id}`, {
        type: transformType,
        value: transformValue
      });
      setImagePreview(res.data.url);
      alert('Transformation successful!');
    } catch (err) {
      alert('Error transforming image');
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">File Manager</h2>
      {loading && <div>Loading...</div>}
      <table className="w-full border mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th>Name</th>
            <th>Size</th>
            <th>Type</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map(file => (
            <tr key={file._id} className="border-b">
              <td>{file.name}</td>
              <td>{(file.size / 1024).toFixed(1)} KB</td>
              <td>{file.type}</td>
              <td>{new Date(file.uploadDate).toLocaleString()}</td>
              <td>
                <button className="mr-2 text-blue-600" onClick={() => handleDownload(file)}>Download</button>
                <button className="mr-2 text-red-600" onClick={() => handleDelete(file._id)}>Delete</button>
                <button className="text-green-600" onClick={() => handleSelect(file)}>Transform</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selectedFile && imagePreview && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Image Preview</h3>
          <img src={imagePreview} alt="Preview" className="max-w-xs mb-2 border" />
          <div className="flex gap-2 mb-2">
            <select value={transformType} onChange={e => setTransformType(e.target.value as any)} className="border p-1">
              <option value="">Select transformation</option>
              <option value="resize">Resize</option>
              <option value="rotate">Rotate</option>
              <option value="crop">Crop</option>
            </select>
            <input type="text" placeholder="Value (e.g. 200x200, 90deg)" value={transformValue} onChange={e => setTransformValue(e.target.value)} className="border p-1" />
            <button className="bg-blue-500 text-white px-3 py-1" onClick={handleTransform}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManager;
