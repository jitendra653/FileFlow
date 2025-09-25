import cron from 'node-cron';
import UserModel from '../models/user';
import PaymentModel from '../models/payment';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const planLimits = {
  free: { storageLimit: 1073741824, apiCallLimit: 1000 },
  basic: { storageLimit: 5368709120, apiCallLimit: 5000 },
  premium: { storageLimit: 10737418240, apiCallLimit: 10000 },
};

cron.schedule('0 0 * * *', async () => {
  console.log('Running daily check for user plans...');

  const users = await UserModel.find({});

  for (const user of users) {
    const lastPayment = await PaymentModel.findOne({ user: user._id, status: 'COMPLETED' })
      .sort({ createdAt: -1 });

    if (lastPayment) {
      const paymentDate = new Date(lastPayment.createdAt);
      const currentDate = new Date();

      const timeDiff = currentDate.getTime() - paymentDate.getTime();
      const daysSincePayment = timeDiff / (1000 * 3600 * 24);

      if (daysSincePayment > 30) {
        // Reset user to free plan
        user.plan = 'free';
        user.quota.storageLimit = planLimits['free'].storageLimit;
        user.quota.apiCallLimit = planLimits['free'].apiCallLimit;
        await user.save();
      } else if (daysSincePayment > 28) {
        // Send email reminder
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: 'Your subscription is about to expire',
          html: `<p>Dear ${user.email},</p>
                 <p>Your subscription plan will expire in 2 days. Please renew your subscription to continue enjoying our services.</p>
                 <a href="${process.env.APP_URL}/renew">Renew Now</a>`
        };

        try {
          await transporter.sendMail(mailOptions);
          console.log(`Reminder email sent to ${user.email}`);
        } catch (err) {
          console.error(`Failed to send email to ${user.email}:`, err);
        }
      }
    } else {
      // No payment found, reset to free plan
      user.plan = 'free';
      user.quota.storageLimit = planLimits['free'].storageLimit;
      user.quota.apiCallLimit = planLimits['free'].apiCallLimit;
      await user.save();
    }
  }
});
