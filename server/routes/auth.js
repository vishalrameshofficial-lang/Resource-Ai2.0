import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../db/database.js';
import { signToken, authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ success: false, error: 'Invalid email or password credentials' });
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
});

router.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

export default router;
