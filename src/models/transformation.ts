import mongoose from 'mongoose';

export interface ITransformation extends mongoose.Document {
  fileId: mongoose.Types.ObjectId;
  userId: number;
  originalPath: string;
  transformedPath: string;
  type: string;
  parameters: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  metadata: {
    originalSize: number;
    transformedSize: number;
    originalFormat: string;
    transformedFormat: string;
    duration: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TransformationSchema = new mongoose.Schema<ITransformation>({
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
  userId: { type: Number, required: true },
  originalPath: { type: String, required: true },
  transformedPath: { type: String },
  type: { type: String, required: true }, // resize, convert, compress, etc.
  parameters: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  error: { type: String },
  metadata: {
    originalSize: { type: Number },
    transformedSize: { type: Number },
    originalFormat: { type: String },
    transformedFormat: { type: String },
    duration: { type: Number } // processing duration in milliseconds
  }
}, { timestamps: true });

// Index for efficient queries
TransformationSchema.index({ userId: 1, status: 1 });
TransformationSchema.index({ fileId: 1, type: 1 });
TransformationSchema.index({ createdAt: 1 });

export default mongoose.model<ITransformation>('Transformation', TransformationSchema);