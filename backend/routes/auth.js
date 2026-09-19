const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

// POST /api/v1/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ detail: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ detail: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return res.json({
    access_token: token,
    token_type: 'bearer',
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    }
  });
});

// GET /api/v1/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, full_name, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ detail: 'User not found' });
  }
  return res.json(user);
});

module.exports = router;
