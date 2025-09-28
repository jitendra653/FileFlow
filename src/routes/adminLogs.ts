import express from 'express';
// import requireAdmin from '../middleware/adminAuth';
import fs from 'fs';
import path from 'path';
import { requireAdmin } from '../middleware/adminAuth';

const router = express.Router();

// GET /v1/admin/logs - Return recent application logs (simple file tail)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const logPath = path.join(__dirname, '../../logs/queryable.log');
    if (!fs.existsSync(logPath)) {
      return res.json([]);
    }
    const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
    // Return last 200 lines
    const recent = lines.slice(-200).map(line => {
      // Try to parse log line (assume JSON or fallback to raw)
      try {
        return JSON.parse(line);
      } catch {
        return { timestamp: '', level: '', message: line };
      }
    });
    res.json(recent);
  } catch (err) {
    res.status(500).json({ error: 'Could not read logs' });
  }
});

export default router;
