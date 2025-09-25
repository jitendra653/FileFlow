import * as React from 'react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../utils/apiConfig';

interface FileInfo {
  _id: string;
  userId: number | string;
  originalName: string;
  path: string;
  size: number;
  category: string;
  mimeType: string;
  downloads: number;
  transformations: number;
  createdAt: string;
  updatedAt: string;
  downloadUrl?: string;
  previewUrl?: string;
  isFavorite?: boolean;
  caption?: string;
  tags?: string[];
  annotation?: string;
}

const AdvancedGallery = () => {
  const [images, setImages] = useState([] as FileInfo[]);
  const [selected, setSelected] = useState(null as FileInfo | null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [bulkSelected, setBulkSelected] = useState([] as string[]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      console.log({ token });
      const res = await axios.get('/v1/files/user-files?limit=100', {
        baseURL: API_BASE_URL,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      let files = res.data.files || [];
      console.log({files});
      
      files = files.filter((f: FileInfo) => f?.mimeType?.startsWith('image/'));
      setImages(files);
    } catch (err) {
        console.log({ err });
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

  const handleFavorite = async (file: FileInfo) => {
    const token = localStorage.getItem('authToken');
    await axios.post(`/v1/files/user-files/${file._id}/favorite`, {}, {
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    fetchImages();
  };

  const handleShare = async (file: FileInfo) => {
    const token = localStorage.getItem('authToken');
    const res = await axios.post(`/v1/files/user-files/${file._id}/share`, {}, {
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    window.prompt('Shareable link:', res.data.url);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm('Delete selected images?')) return;
    const token = localStorage.getItem('authToken');
    await axios.post('/v1/files/user-files/bulk-delete', { fileIds: bulkSelected }, {
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    setBulkSelected([]);
    fetchImages();
  };

  const handleMetadataUpdate = async (file: FileInfo, caption: string, tags: string[]) => {
    const token = localStorage.getItem('authToken');
    await axios.patch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/v1/files/user-files/${file._id}/metadata`, { caption, tags }, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    fetchImages();
  };

  // Search and filter
  const filteredImages = images.filter((img: FileInfo) =>
  (!search || img.originalName.toLowerCase().includes(search.toLowerCase())) &&
  (!tagFilter || (img.tags || []).includes(tagFilter))
  );

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Advanced Image Gallery</h2>
      <div className="mb-4 flex gap-2">
  <input type="text" placeholder="Search by name" value={search} onChange={(e: any) => setSearch(e.target.value)} className="border p-1" />
  <input type="text" placeholder="Filter by tag" value={tagFilter} onChange={(e: any) => setTagFilter(e.target.value)} className="border p-1" />
        <button className="bg-red-500 text-white px-3 py-1" onClick={handleBulkDelete} disabled={!bulkSelected.length}>Bulk Delete</button>
      </div>
      {loading && <div>Loading...</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {filteredImages.map((img: FileInfo) => (
          <div key={img._id} className={`border rounded overflow-hidden cursor-pointer relative ${bulkSelected.includes(img._id) ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => openModal(img)}>
            <input type="checkbox" className="absolute top-2 left-2" checked={bulkSelected.includes(img._id)} onChange={(e: any) => {
              e.stopPropagation();
              setBulkSelected((bs: string[]) => bs.includes(img._id) ? bs.filter((id: string) => id !== img._id) : [...bs, img._id]);
            }} />
            <img src={`${img.previewUrl}`} alt={img.originalName} className="w-full h-32 object-cover" />
            <div className="p-2 text-sm text-center flex justify-between items-center">
              <span>{img.originalName}</span>
              <button className="text-yellow-500" onClick={(e: any) => { e.stopPropagation(); handleFavorite(img); }}>{img.isFavorite ? '★' : '☆'}</button>
            </div>
          </div>
        ))}
      </div>
      {modalOpen && selected && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow-lg max-w-lg w-full relative">
            <button className="absolute top-2 right-2 text-xl" onClick={closeModal}>&times;</button>
            <img src={`${selected.previewUrl}`} alt={selected.originalName} className="w-full mb-2" />
            <div className="mb-2 font-bold">{selected.originalName}</div>
            <div>Size: {(selected.size / 1024).toFixed(1)} KB</div>
            <div>Type: {selected.type}</div>
            <div>Date: {new Date(selected.uploadDate).toLocaleString()}</div>
            <div>Caption: {selected.caption || ''}</div>
            <div>Tags: {(selected.tags || []).join(', ')}</div>
            <div className="mt-2 flex gap-2">
              <button className="bg-blue-500 text-white px-3 py-1" onClick={() => handleShare(selected)}>Share</button>
              <button className="bg-yellow-500 text-white px-3 py-1" onClick={() => handleFavorite(selected)}>{selected.isFavorite ? 'Unfavorite' : 'Favorite'}</button>
            </div>
            <div className="mt-2">
              <input type="text" placeholder="Edit caption" defaultValue={selected.caption || ''} className="border p-1 mb-1 w-full" id="captionInput" />
              <input type="text" placeholder="Edit tags (comma separated)" defaultValue={(selected.tags || []).join(', ')} className="border p-1 w-full" id="tagsInput" />
              <button className="bg-green-500 text-white px-3 py-1 mt-2" onClick={() => {
                const caption = (document.getElementById('captionInput') as HTMLInputElement).value;
                const tags = (document.getElementById('tagsInput') as HTMLInputElement).value.split(',').map(t => t.trim()).filter(Boolean);
                handleMetadataUpdate(selected, caption, tags);
                closeModal();
              }}>Save Metadata</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedGallery;
