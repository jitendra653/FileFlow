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

const FileGallery: React.FC = () => {
  const [images, setImages] = useState<FileInfo[]>([]);
  const [selected, setSelected] = useState<FileInfo | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/v1/files/user-files?limit=100`, {
        baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const files = res.data.files || [];
      setImages(files.filter((f: FileInfo) => f.type.startsWith('image/')));
    } catch (err) {
      alert('Error fetching images');
    }
    setLoading(false);
  };

  const openModal = (file: FileInfo) => {
    setSelected(file);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelected(null);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Image Gallery</h2>
      {loading && <div>Loading...</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {images.map(img => (
          <div key={img._id} className="border rounded overflow-hidden cursor-pointer" onClick={() => openModal(img)}>
            <img src={img.url || `/v1/files/preview?token=${img._id}`} alt={img.name} className="w-full h-32 object-cover" />
            <div className="p-2 text-sm text-center">{img.name}</div>
          </div>
        ))}
      </div>
      {modalOpen && selected && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow-lg max-w-lg w-full relative">
            <button className="absolute top-2 right-2 text-xl" onClick={closeModal}>&times;</button>
            <img src={selected.url || `/v1/files/preview?token=${selected._id}`} alt={selected.name} className="w-full mb-2" />
            <div className="mb-2 font-bold">{selected.name}</div>
            <div>Size: {(selected.size / 1024).toFixed(1)} KB</div>
            <div>Type: {selected.type}</div>
            <div>Date: {new Date(selected.uploadDate).toLocaleString()}</div>
            {/* Add more advanced features here, e.g. image actions, sharing, etc. */}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileGallery;
