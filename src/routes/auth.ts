
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/user';


const router = express.Router();


router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/login', async (req, res) => {
  const { email, password, rememberMe = false } = req.body;
  const expiresIn = rememberMe === true ? "30d" : "2h";
  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.password) {
      return res.status(500).json({ error: 'User password is missing. Please contact support.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        id: user._id,
        _id: user._id,
        userId: user.userId,
        email: user.email,
        role: user.role || 'user'
      }, 
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn }
    );

    res.cookie('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn === "30d" ? 30 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000 // ms
    });
    res.status(200).json({
      user: {
        id: user._id,
        userId: user.userId,
        email: user.email,
        role: user.role || 'user'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user info from cookie
router.get('/me', (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    res.json({ user: payload });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout: clear cookie
router.post('/logout', (req, res) => {
  res.clearCookie('access_token');
  res.status(200).json({ message: 'Logged out' });
});

export default router;
