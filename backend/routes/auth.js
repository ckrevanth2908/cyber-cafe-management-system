const express = require('express');
const router = express.Router();

// Fallback open login endpoint
router.post('/login', (req, res) => {
  return res.json({
    token: 'public_operator_token',
    access_token: 'public_operator_token',
    user: {
      id: 1,
      username: 'operator',
      full_name: 'Café Operator',
      role: 'admin'
    }
  });
});

router.get('/me', (req, res) => {
  return res.json({
    id: 1,
    username: 'operator',
    full_name: 'Café Operator',
    role: 'admin'
  });
});

module.exports = router;
