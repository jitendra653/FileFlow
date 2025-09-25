import mongoose from 'mongoose';

export interface IUser extends mongoose.Document {
  email: string;
  apiKey?: string;
  role: 'user' | 'admin' | 'superadmin';
  status: 'active' | 'suspended' | 'banned';
  isAdmin?: boolean; // Computed property
  password: string;
  userId: number;
  plan: 'free' | 'basic' | 'premium';
  securitySettings?: {
    ipWhitelist: {
      enabled: boolean;
      ips: string[];
    };
    twoFactorAuth: {
      enabled: boolean;
      secret?: string;
      backupCodes?: string[];
    };
    sessionTimeout: number; // in minutes
  };
  quota?: {
    storageUsed: number; // in bytes
    apiCallsMade: number;
    storageLimit: number; // in bytes
    apiCallLimit: number; // API call limit based on plan
  };
}

const planLimits = {
  free: { storageLimit: 1073741824, apiCallLimit: 1000 }, // 1GB, 1000 calls
  basic: { storageLimit: 5368709120, apiCallLimit: 5000 }, // 5GB, 5000 calls
  premium: { storageLimit: 10737418240, apiCallLimit: 10000 }, // 10GB, 10000 calls
};

const UserSchema = new mongoose.Schema<IUser>({
  email: { type: String, required: true, unique: true },
  apiKey: { type: String },
  role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
  status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
  password: { type: String, required: true }, // Add password field
  userId: { type: Number, unique: true }, // Unique user ID for folder management
  plan: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
  securitySettings: {
    ipWhitelist: {
      enabled: { type: Boolean, default: false },
      ips: [{ type: String }]
    },
    twoFactorAuth: {
      enabled: { type: Boolean, default: false },
      secret: { type: String },
      backupCodes: [{ type: String }]
    },
    sessionTimeout: { type: Number, default: 60 } // 60 minutes default
  },
  quota: {
    storageUsed: { type: Number, default: 0 },
    apiCallsMade: { type: Number, default: 0 },
    storageLimit: { type: Number, default: planLimits['free'].storageLimit },
    apiCallLimit: { type: Number, default: planLimits['free'].apiCallLimit },
    lastResetDate: { type: Date, default: Date.now },
    apiUsageHistory: [{
      date: { type: Date },
      calls: { type: Number },
      endpoints: { type: Map, of: Number } // Track calls per endpoint
    }]
  },
}, { timestamps: true });

// Auto-increment userId for each new user
UserSchema.pre('save', async function (next) {
  if (!this.isNew) return next();

  const lastUser = await mongoose.model<IUser>('User').findOne().sort({ userId: -1 });
  this.userId = lastUser ? lastUser.userId + 1 : 1;

  // Set storageLimit and apiCallLimit based on the plan
  const plan = planLimits[this.plan] || planLimits['free'];
  this.quota.storageLimit = plan.storageLimit;
  this.quota.apiCallLimit = plan.apiCallLimit;
  next();
});

// Virtual property for admin check
UserSchema.virtual('isAdmin').get(function(this: IUser) {
  return ['admin', 'superadmin'].includes(this.role);
});

// Ensure virtuals are included in JSON
UserSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model<IUser>('User', UserSchema);
