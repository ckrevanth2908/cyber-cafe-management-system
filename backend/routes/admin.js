const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// GET /api/v1/admin/config
router.get('/config', (req, res) => {
  let config = db.prepare('SELECT * FROM system_config LIMIT 1').get();
  if (!config) {
    db.prepare('INSERT INTO system_config (cafe_name) VALUES (?)').run('CyberNet Cafe');
    config = db.prepare('SELECT * FROM system_config LIMIT 1').get();
  }
  return res.json(config);
});

// PUT /api/v1/admin/config
router.put('/config', (req, res) => {
  const { cafe_name, address, phone, email, age_restriction_gaming, session_warning_minutes } = req.body;
  const current = db.prepare('SELECT id FROM system_config LIMIT 1').get();
  
  if (current) {
    db.prepare(`
      UPDATE system_config 
      SET cafe_name = COALESCE(?, cafe_name),
          address = COALESCE(?, address),
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          age_restriction_gaming = COALESCE(?, age_restriction_gaming),
          session_warning_minutes = COALESCE(?, session_warning_minutes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(cafe_name, address, phone, email, age_restriction_gaming, session_warning_minutes, current.id);
  } else {
    db.prepare(`
      INSERT INTO system_config (cafe_name, address, phone, email, age_restriction_gaming, session_warning_minutes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(cafe_name || 'CyberNet Cafe', address, phone, email, age_restriction_gaming || 15, session_warning_minutes || 5);
  }

  const updated = db.prepare('SELECT * FROM system_config LIMIT 1').get();
  return res.json(updated);
});

// GET /api/v1/admin/stats
router.get('/stats', (req, res) => {
  const activeSessions = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'active'").get().count;
  const availableTerminals = db.prepare("SELECT COUNT(*) as count FROM terminals WHERE status = 'available'").get().count;
  const totalTerminals = db.prepare("SELECT COUNT(*) as count FROM terminals").get().count;
  const totalCustomers = db.prepare("SELECT COUNT(*) as count FROM customers").get().count;
  const completedToday = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'completed' AND DATE(start_time) = DATE('now')").get().count;
  
  const today = new Date().toISOString().slice(0, 10);
  const revenueRecord = db.prepare('SELECT total_revenue FROM daily_revenue WHERE date = ?').get(today);
  const todayRevenue = revenueRecord ? revenueRecord.total_revenue : 0;

  return res.json({
    active_sessions: activeSessions,
    available_terminals: availableTerminals,
    total_terminals: totalTerminals,
    total_customers: totalCustomers,
    completed_today: completedToday,
    today_revenue: todayRevenue
  });
});

module.exports = router;
