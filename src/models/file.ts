import mongoose from 'mongoose';

export interface IFile extends mongoose.Document {
  userId: number; // Changed to number for compatibility
  originalName: string;
  path: string;
  size: number;
  category: string;
  mimeType: string;
  downloads: number; // Track the number of downloads
  transformations?: number; // Track the number of transformations
}

const FileSchema = new mongoose.Schema<IFile>({
  userId: { type: Number, required: true }, // Changed to number for compatibility
  originalName: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, required: true },
  category: { type: String, default: 'default' },
  mimeType: { type: String },
  downloads: { type: Number, default: 0 },
  transformations: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model<IFile>('File', FileSchema);
