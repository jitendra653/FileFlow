import mongoose from 'mongoose';

export interface IFile extends mongoose.Document {
  userId: number;
  originalName: string;
  path: string;
  size: number;
  category: string;
  mimeType: string;
  downloads: number;
  transformations?: number;
  caption?: string;
  tags?: string[];
  annotation?: string;
  isFavorite?: boolean;
}

const FileSchema = new mongoose.Schema<IFile>({
  userId: { type: Number, required: true },
  originalName: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, required: true },
  category: { type: String, default: 'default' },
  mimeType: { type: String },
  downloads: { type: Number, default: 0 },
  transformations: { type: Number, default: 0 },
  caption: { type: String },
  tags: [{ type: String }],
  annotation: { type: String },
  isFavorite: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model<IFile>('File', FileSchema);
