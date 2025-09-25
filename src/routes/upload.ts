import { Request, Response, Router } from 'express';
import multer from 'multer';
import path from 'path';   
import fs from 'fs';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { checkCategory } from '../middleware/validate';
import FileModel from '../models/file';
import UserModel from '../models/user';
import { emitToUser, emitToAdmin, fileEvents } from '../utils/socketEvents';
import { processStatus } from '../utils/processStatus';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id?: string;
        _id?: string;
      };
    }
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        const userId = req.user?.id || req.user?._id;
        const user = await UserModel.findById(userId);
        if (!user) return cb(new Error('User not found'), '');
        const category = req.headers['x-category'] || 'default';
        const folderPath = `uploads/${user.userId}/${category}/`; // Use userId for folder management
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }
        cb(null, folderPath);
      } catch (err) {
        cb(err as Error, '');
      }
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type') as unknown as null, false);
    }
  },
});

const router = Router();

router.post('/', requireAuth, ...(Array.isArray(checkCategory) ? checkCategory : []), (req: AuthRequest, res, next) => {
  const userId = req.user?.id || req.user?._id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

    const processId = `upload-${Date.now()}-${userId}`;
  
  // Emit upload started event
  emitToUser(userId.toString(), fileEvents.UPLOAD_STARTED, {
    processId,
    message: 'Starting upload'
  });

  processStatus.startProcess(processId, {
    fileId: '',
    userId: userId.toString(),
    type: 'upload',
    progress: 0,
    status: 'pending',
    message: 'Starting upload'
  });

  const uploadHandler = upload.single('file');
  
  // Track upload progress
  let uploadedBytes = 0;
  req.on('data', (chunk) => {
    uploadedBytes += chunk.length;
    const progress = Math.min(Math.round((uploadedBytes / (req.headers['content-length'] || 1)) * 100), 99);
    
    processStatus.updateProgress(processId, progress, {
      bytesUploaded: uploadedBytes,
      totalBytes: req.headers['content-length']
    });
    
    emitToUser(userId.toString(), fileEvents.UPLOAD_PROGRESS, {
      processId,
      progress,
      bytesUploaded: uploadedBytes,
      totalBytes: req.headers['content-length']
    });
  });

  uploadHandler(req, res, async (err) => {
    if (err) {
      emitToUser(userId.toString(), fileEvents.UPLOAD_FAILED, { error: err.message });
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      emitToUser(userId.toString(), fileEvents.UPLOAD_FAILED, { error: 'No file uploaded' });
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
    const userId = req.user?.id || req.user?._id;
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newStorageUsed = user.quota.storageUsed + req.file.size;
    if (newStorageUsed > user.quota.storageLimit) {
      return res.status(403).json({ error: 'Storage quota exceeded' });
    }

    user.quota.storageUsed = newStorageUsed;
    await user.save();

    const fileDoc = await FileModel.create({
      userId: user.userId, // Use userId for file association
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      category: req.headers['x-category'] || 'default',
      mimeType: req.file.mimetype
    });

    // Emit upload completed event
    emitToUser(userId.toString(), fileEvents.UPLOAD_COMPLETED, { 
      file: fileDoc,
      message: 'File uploaded successfully' 
    });
 // Update process status to completed
    processStatus.updateStatus(processId, {
      status: 'completed',
      progress: 100,
      fileId: fileDoc._id.toString(),
      message: 'File uploaded successfully',
      details: fileDoc
    });


    // Emit to admin for monitoring
    emitToAdmin(fileEvents.UPLOAD_COMPLETED, {
      userId: user.userId,
      file: fileDoc
    });

    res.json({ ok: true, file: fileDoc });
  } catch (err) {
    emitToUser(userId.toString(), fileEvents.UPLOAD_FAILED, { 
      error: err instanceof Error ? err.message : 'Upload failed' 
    });
    next(err);
  }
  });
});

export default router;
