import cron from 'node-cron';
import UserModel from '../models/user';
import logger from '../utils/logger';

// Reset API call counters at the beginning of each month
cron.schedule('0 0 1 * *', async () => {
  try {
    logger.info('Starting monthly API call counter reset');
    
    // Reset apiCallsMade to 0 for all users
    const result = await UserModel.updateMany(
      {},
      { 'quota.apiCallsMade': 0 }
    );

    logger.info('Monthly API call counters reset completed', {
      usersUpdated: result.modifiedCount
    });
  } catch (error) {
    logger.error('Error resetting API call counters', { error });
  }
});

export default {};