import { emitToUser, fileEvents } from './socketEvents';
import { TransformationDocument } from '../models/transformation';
import logger from './logger';

interface ProcessStatus {
  fileId: string;
  userId: string;
  type: 'upload' | 'transform' | 'download';
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  error?: string;
  details?: any;
}

class ProcessStatusManager {
  private processes: Map<string, ProcessStatus>;

  constructor() {
    this.processes = new Map();
  }

  // Start tracking a new process
  startProcess(processId: string, status: ProcessStatus) {
    this.processes.set(processId, status);
    this.emitUpdate(processId);
  }

  // Update process progress
  updateProgress(processId: string, progress: number, details?: any) {
    const process = this.processes.get(processId);
    if (process) {
      process.progress = progress;
      if (details) {
        process.details = { ...process.details, ...details };
      }
      this.emitUpdate(processId);
    }
  }

  // Update process status
  updateStatus(processId: string, updates: Partial<ProcessStatus>) {
    const process = this.processes.get(processId);
    if (process) {
      Object.assign(process, updates);
      this.emitUpdate(processId);

      // Clean up completed or failed processes after a delay
      if (process.status === 'completed' || process.status === 'failed') {
        setTimeout(() => {
          this.processes.delete(processId);
        }, 1000 * 60 * 5); // Keep for 5 minutes
      }
    }
  }

  // Get process status
  getStatus(processId: string): ProcessStatus | undefined {
    return this.processes.get(processId);
  }

  // Get all processes for a user
  getUserProcesses(userId: string): ProcessStatus[] {
    return Array.from(this.processes.values())
      .filter(process => process.userId === userId);
  }

  // Emit status update via WebSocket
  private emitUpdate(processId: string) {
    const process = this.processes.get(processId);
    if (!process) return;

    let eventType: string;
    switch (process.type) {
      case 'upload':
        eventType = process.status === 'completed' ? fileEvents.UPLOAD_COMPLETED :
                   process.status === 'failed' ? fileEvents.UPLOAD_FAILED :
                   fileEvents.UPLOAD_PROGRESS;
        break;
      case 'transform':
        eventType = process.status === 'completed' ? fileEvents.TRANSFORM_COMPLETED :
                   process.status === 'failed' ? fileEvents.TRANSFORM_FAILED :
                   fileEvents.TRANSFORM_PROGRESS;
        break;
      default:
        return;
    }

    try {
      emitToUser(process.userId, eventType, {
        processId,
        fileId: process.fileId,
        progress: process.progress,
        status: process.status,
        message: process.message,
        error: process.error,
        details: process.details
      });
    } catch (error) {
      logger.error('Error emitting process update:', { error, processId });
    }
  }
}

// Create a singleton instance
export const processStatus = new ProcessStatusManager();