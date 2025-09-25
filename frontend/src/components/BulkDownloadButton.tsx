import * as React from 'react';
import axios from 'axios';

interface FileInfo {
  _id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: string;
  url?: string;
}

type BulkDownloadButtonProps = { selectedIds: string[] };
const BulkDownloadButton = ({ selectedIds }: BulkDownloadButtonProps) => {
  const handleBulkDownload = async () => {
    if (!selectedIds.length) {
      alert('Select images to download.');
      return;
    }
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/v1/files/user-files/bulk-download`, { fileIds: selectedIds }, {
        responseType: 'blob',
        baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'images.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Bulk download failed.');
    }
  };

  return (
    <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleBulkDownload} disabled={!selectedIds.length}>
      Download Selected as ZIP
    </button>
  );
};

export default BulkDownloadButton;
