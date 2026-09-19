const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// GET /api/v1/revenue/daily
router.get('/daily', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  let record = db.prepare('SELECT * FROM daily_revenue WHERE date = ?').get(date);

  if (!record) {
    record = {
      date,
      browsing_revenue: 0,
      gaming_revenue: 0,
      academic_revenue: 0,
      plain_print_revenue: 0,
      colour_print_revenue: 0,
      xerox_revenue: 0,
      total_revenue: 0,
      num_customers: 0,
      num_sessions: 0,
      num_print_transactions: 0
    };
  }

  return res.json(record);
});

// GET /api/v1/revenue/summary
router.get('/summary', (req, res) => {
  const { from_date, to_date } = req.query;
  const from = from_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = to_date || new Date().toISOString().slice(0, 10);

  const dailyRows = db.prepare(`
    SELECT * FROM daily_revenue
    WHERE date >= ? AND date <= ?
    ORDER BY date ASC
  `).all(from, to);

  const aggregate = db.prepare(`
    SELECT 
      COALESCE(SUM(browsing_revenue), 0) as total_browsing,
      COALESCE(SUM(gaming_revenue), 0) as total_gaming,
      COALESCE(SUM(academic_revenue), 0) as total_academic,
      COALESCE(SUM(plain_print_revenue), 0) as total_plain_print,
      COALESCE(SUM(colour_print_revenue), 0) as total_colour_print,
      COALESCE(SUM(xerox_revenue), 0) as total_xerox,
      COALESCE(SUM(total_revenue), 0) as total_revenue,
      COALESCE(SUM(num_sessions), 0) as total_sessions,
      COALESCE(SUM(num_print_transactions), 0) as total_print_transactions
    FROM daily_revenue
    WHERE date >= ? AND date <= ?
  `).get(from, to);

  return res.json({
    from_date: from,
    to_date: to,
    totals: aggregate,
    daily_records: dailyRows
  });
});

// GET /api/v1/revenue/sessions-today
router.get('/sessions-today', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const sessions = db.prepare(`
    SELECT s.*, c.name as customer_name, t.terminal_number, tt.name as terminal_type_name
    FROM sessions s
    JOIN customers c ON s.customer_id = c.id
    JOIN terminals t ON s.terminal_id = t.id
    JOIN terminal_types tt ON t.type_id = tt.id
    WHERE DATE(s.start_time) = ? AND s.status = 'completed'
    ORDER BY s.id DESC
  `).all(today);
  return res.json(sessions);
});

module.exports = router;
