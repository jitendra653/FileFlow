const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../dist/models/user').default;

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/rdx_project';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

async function run() {
  await mongoose.connect(MONGO);
  const email = process.argv[2] || 'test@example.com';
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ email, role: 'user' });
  }
  const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  console.log('User id:', user._id.toString());
  console.log('JWT:', token);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
