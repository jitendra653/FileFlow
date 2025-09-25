import mongoose from 'mongoose';

export interface IPayment extends mongoose.Document {
  user: mongoose.Schema.Types.ObjectId;
  paymentId: string;
  payerId?: string;
  plan: 'free' | 'basic' | 'premium';
  amount: number;
  currency: string;
  status: string;
  raw: any;
  createdAt?: Date;
}

const PaymentSchema = new mongoose.Schema<IPayment>({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  paymentId: { type: String, required: true },
  payerId: { type: String },
  plan: { type: String, enum: ['free', 'basic', 'premium'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  status: { type: String, required: true },
  raw: { type: mongoose.Schema.Types.Mixed },
  createdAt:{ type: Date, default: Date.now} 
}, { timestamps: true });

export default mongoose.model<IPayment>('Payment', PaymentSchema);
