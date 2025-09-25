// Socket event names
export const fileEvents = {
  // Upload events
  UPLOAD_STARTED: 'file:upload:started',
  UPLOAD_PROGRESS: 'file:upload:progress',
  UPLOAD_COMPLETED: 'file:upload:completed',
  UPLOAD_FAILED: 'file:upload:failed',

  // Transform events
  TRANSFORM_STARTED: 'file:transform:started',
  TRANSFORM_PROGRESS: 'file:transform:progress',
  TRANSFORM_COMPLETED: 'file:transform:completed',
  TRANSFORM_FAILED: 'file:transform:failed',

  // File events
  DELETE: 'file:deleted',
};

// User events
export const userEvents = {
  PROFILE_UPDATED: 'user:profile:updated',
  PLAN_UPDATED: 'user:plan:updated',
  QUOTA_WARNING: 'user:quota:warning',
  QUOTA_EXCEEDED: 'user:quota:exceeded',
};

// Admin events
export const adminEvents = {
  USER_CREATED: 'admin:user:created',
  USER_UPDATED: 'admin:user:updated',
  USER_DELETED: 'admin:user:deleted',
  SYSTEM_ALERT: 'admin:system:alert',
  METRICS_UPDATE: 'admin:metrics:update',
};