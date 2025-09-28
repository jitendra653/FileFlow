import express from 'express';
import { requireAdmin } from '../middleware/adminAuth';
import { healthMonitor } from '../utils/healthMonitor';
import logger from '../utils/logger';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: process.env.npm_package_version,
    timestamp: new Date().toISOString()
  });
});


// Get current health metrics
router.get('/metrics', requireAdmin, (req, res) => {
  try {
    const metrics = healthMonitor.getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Error fetching health metrics:', error);
    res.status(500).json({ error: 'Failed to fetch health metrics' });
  }
});

// Get historical metrics
router.get('/metrics/history', requireAdmin, (req, res) => {
  try {
    const history = healthMonitor.getMetricsHistory();
    res.json(history);
  } catch (error) {
    logger.error('Error fetching metrics history:', error);
    res.status(500).json({ error: 'Failed to fetch metrics history' });
  }
});

// Get alert history
router.get('/alerts', requireAdmin, (req, res) => {
  try {
    const alerts = healthMonitor.getAlertHistory();
    res.json(alerts);
  } catch (error) {
    logger.error('Error fetching alert history:', error);
    res.status(500).json({ error: 'Failed to fetch alert history' });
  }
});

// Update monitoring thresholds
router.post('/thresholds', requireAdmin, (req, res) => {
  try {
    const newThresholds = req.body;
    healthMonitor.updateThresholds(newThresholds);
    res.json({ message: 'Thresholds updated successfully' });
  } catch (error) {
    logger.error('Error updating thresholds:', error);
    res.status(500).json({ error: 'Failed to update thresholds' });
  }
});

export default router;