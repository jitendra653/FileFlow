import express from 'express';
import UserModel from '../models/user';
import PaymentModel from '../models/payment';
import { requireAuth, AuthRequest } from '../middleware/auth';
import paypal from 'paypal-rest-sdk';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Configure PayPal SDK
paypal.configure({
  mode: 'sandbox', // Use 'live' for production
  client_id: 'AYbATm0HIv0I604WpriPOEZISuxynJqruhktrbxr1btC06LJpNdpuGEEhsDnwwSwshYAhf5sdgoOR5q2',
  client_secret: 'EPJX9vFFmIFaN1sQ5bkz38I6Tqgo_LStGmi0zL1D-deqW9M1dwTG2U46HX0iB4ecw1K2I-V7kPbEelKN'
});
// process.env.PAYPAL_CLIENT_SECRET || 'your-client-secret',
// || process.env.PAYPAL_CLIENT_ID || 'your-client-id',

const planPrices = {
  free: 0,
  basic: 10, // $10 per month
  premium: 20, // $20 per month
};

// Create payment route
router.post('/create-payment', requireAuth, async (req: AuthRequest, res) => {
  const { plan } = req.body;
  if (!planPrices[plan]) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const temporaryToken = jwt.sign(
    { userId: req.user.id, plan },
    process.env.JWT_SECRET || 'jwt_secret',
    { expiresIn: '1h' } // Token expires in 1 hour
  );

  console.log('Creating PayPal payment for plan:', {plan,  client_id: process.env.PAYPAL_CLIENT_ID || 'your-client-id',
  client_secret: process.env.PAYPAL_CLIENT_SECRET || 'your-client-secret'});

  const paymentData = {
    intent: 'sale',
    payer: {
      payment_method: 'paypal',
    },
    redirect_urls: {
      return_url: `${req.protocol}://${req.get('host')}/v1/plan/execute-payment?authToken=${temporaryToken}`,
      cancel_url: `${req.protocol}://${req.get('host')}/v1/plan/cancel-payment`,
    },
    transactions: [
      {
        amount: {
          total: planPrices[plan].toFixed(2),
          currency: 'USD',
        },
        description: `Upgrade to ${plan} plan`,
      },
    ],
  };

  paypal.payment.create(paymentData, async (err, payment) => {
    if (err) {
      console.error('PayPal payment creation error:', err);
      return res.status(500).json({ error: 'Failed to create PayPal payment' });
    }

    const approvalUrl = payment.links.find((link) => link.rel === 'approval_url');
    // Save payment record
    try {
      console.log('Saving payment record:', {
        user: req.user.id,
        paymentId: payment.id,
        plan,
        amount: planPrices[plan],
        currency: 'USD',
        status: payment.state,
        raw: payment,
      });
      await PaymentModel.create({
        user: req.user.id,
        paymentId: payment.id,
        plan,
        amount: planPrices[plan],
        currency: 'USD',
        status: payment.state,
        raw: payment,
      });
    } catch (e) {
      console.error('Error saving payment record:', e);
    }
    res.json({ approvalUrl: approvalUrl.href });
  });
});

// Execute payment route
router.get('/execute-payment', async (req, res) => {
  const { authToken } = req.query;

  try {
    const decoded = jwt.verify(authToken as string, process.env.JWT_SECRET || 'jwt_secret');
    const { userId, plan } = decoded as { userId: string; plan: string };

    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const paymentId = req.query.paymentId as string;
    const PayerID = req.query.PayerID as string;

    const executeData = {
      payer_id: PayerID,
      transactions: [
        {
          amount: {
            total: planPrices[plan].toFixed(2),
            currency: 'USD',
          },
        },
      ],
    };

    paypal.payment.execute(paymentId, executeData, async (err, payment) => {
      if (err) {
        console.error('PayPal payment execution error:', err);
        await PaymentModel.findOneAndUpdate(
          { paymentId },
          { status: 'failed', raw: err },
          { new: true }
        );
        return res.status(500).json({ error: 'Failed to execute PayPal payment' });
      }

      user.plan = plan as 'free' | 'basic' | 'premium';
      const planLimits = {
        free: { storageLimit: 1073741824, apiCallLimit: 1000 },
        basic: { storageLimit: 5368709120, apiCallLimit: 5000 },
        premium: { storageLimit: 10737418240, apiCallLimit: 10000 },
      };

      user.quota.storageLimit = planLimits[plan].storageLimit;
      user.quota.apiCallLimit = planLimits[plan].apiCallLimit;
      await user.save();

      await PaymentModel.findOneAndUpdate(
        { paymentId },
        { status: payment.state, raw: payment },
        { new: true }
      );

      // Ensure 'res' is properly used in the redirect
      res.redirect(`http://localhost:5173/payment-success?status=success&plan=${plan}`);
    });
  } catch (err) {
          res.redirect(`http://localhost:5173`);

    console.error('Invalid or expired token:', err);
    res.status(400).json({ error: 'Invalid or expired token' });
  }
});

// Cancel payment route
router.get('/cancel-payment', (req, res) => {
  res.status(200).json({ message: 'Payment cancelled' });
});

// PayPal Webhook route
router.post('/webhook/paypal', express.json({ type: '*/*' }), async (req, res) => {
  const event = req.body;
  try {
    // Only handle payment sale completed/failed events
    if (event.event_type === 'PAYMENT.SALE.COMPLETED' || event.event_type === 'PAYMENT.SALE.DENIED') {
      const resource = event.resource;
      const paymentId = resource.parent_payment || resource.id;
      const status = resource.state || resource.status;
      const payerId = resource.payer?.payer_info?.payer_id || resource.payer_id;
      const amount = parseFloat(resource.amount?.total || resource.amount?.value || 0);
      const currency = resource.amount?.currency || resource.amount?.currency_code || 'USD';

      // Find the payment record and update it
      const paymentDoc = await PaymentModel.findOneAndUpdate(
        { paymentId },
        {
          status,
          raw: resource,
        },
        { new: true }
      );
      // Optionally, notify user or trigger business logic here
    }
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
