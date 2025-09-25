import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';

interface FileInfo {
  _id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: string;
  url?: string;
  isFavorite?: boolean;
  caption?: string;
  tags?: string[];
  annotation?: string;
}

const DragAnnotateGallery = () => {
  const [images, setImages] = useState([] as FileInfo[]);
  const [selected, setSelected] = useState(null as FileInfo | null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draggedId, setDraggedId] = useState(null as string | null);
  const [annotation, setAnnotation] = useState('');
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    const token = localStorage.getItem('authToken');
    const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/v1/files/user-files?limit=100`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    let files = res.data.files || [];
    files = files.filter((f: FileInfo) => f.type.startsWith('image/'));
    setImages(files);
  };

  // Drag-and-drop reordering
  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDrop = (id: string) => {
    if (draggedId && draggedId !== id) {
  const idx1 = images.findIndex((img: FileInfo) => img._id === draggedId);
  const idx2 = images.findIndex((img: FileInfo) => img._id === id);
      const reordered = [...images];
      const [dragged] = reordered.splice(idx1, 1);
      reordered.splice(idx2, 0, dragged);
      setImages(reordered);
      // Optionally: send new order to backend
      const token = localStorage.getItem('authToken');
      axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/v1/files/user-files/reorder`, { order: reordered.map(img => img._id) }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
    }
    setDraggedId(null);
  };

  // Annotation
  const openModal = (file: FileInfo) => {
    setSelected(file);
    setAnnotation(file.annotation || '');
    setModalOpen(true);
    setTimeout(drawImageToCanvas, 100);
  };
  const closeModal = () => {
    setModalOpen(false);
    setSelected(null);
    setAnnotation('');
  };
  const drawImageToCanvas = () => {
    if (!selected || !canvasRef.current) return;
    const img = new window.Image();
    img.src = selected.url || `/v1/files/preview?token=${selected._id}`;
    img.onload = () => {
      const ctx = canvasRef.current!.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      ctx.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
      // Draw annotation text
      ctx.font = '16px Arial';
      ctx.fillStyle = 'red';
      ctx.fillText(annotation, 10, 30);
    };
  };
  const handleAnnotationSave = async () => {
    if (!selected) return;
    const token = localStorage.getItem('authToken');
    await axios.patch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/v1/files/user-files/${selected._id}/annotation`, { annotation }, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    fetchImages();
    closeModal();
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Drag & Annotate Gallery</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {images.map((img: FileInfo) => (
          <div key={img._id}
            className="border rounded overflow-hidden cursor-pointer relative"
            draggable
            onDragStart={() => handleDragStart(img._id)}
            onDragOver={(e: any) => e.preventDefault()}
            onDrop={() => handleDrop(img._id)}
            onClick={() => openModal(img)}>
            <img src={img.url || `/v1/files/preview?token=${img._id}`} alt={img.name} className="w-full h-32 object-cover" />
            <div className="p-2 text-sm text-center">{img.name}</div>
          </div>
        ))}
      </div>
      {modalOpen && selected && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow-lg max-w-lg w-full relative">
            <button className="absolute top-2 right-2 text-xl" onClick={closeModal}>&times;</button>
            <canvas ref={canvasRef} width={400} height={300} className="w-full mb-2 border" />
            <input type="text" value={annotation} onChange={(e: any) => setAnnotation(e.target.value)} placeholder="Add annotation" className="border p-1 w-full mb-2" />
            <button className="bg-green-500 text-white px-3 py-1" onClick={handleAnnotationSave}>Save Annotation</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DragAnnotateGallery;
