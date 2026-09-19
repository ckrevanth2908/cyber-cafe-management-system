const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/v1/sessions
router.get('/', authMiddleware, (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT s.*, c.name as customer_name, c.phone as customer_phone,
           t.terminal_number, tt.name as terminal_type_name
    FROM sessions s
    JOIN customers c ON s.customer_id = c.id
    JOIN terminals t ON s.terminal_id = t.id
    JOIN terminal_types tt ON t.type_id = tt.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND s.status = ?';
    params.push(status);
  }

  query += ' ORDER BY s.id DESC';
  const sessions = db.prepare(query).all(...params);
  return res.json(sessions);
});

// GET /api/v1/sessions/active
router.get('/active', authMiddleware, (req, res) => {
  const active = db.prepare(`
    SELECT s.*, c.name as customer_name, c.phone as customer_phone,
           t.terminal_number, tt.name as terminal_type_name,
           ta.id as allocation_id
    FROM sessions s
    JOIN customers c ON s.customer_id = c.id
    JOIN terminals t ON s.terminal_id = t.id
    JOIN terminal_types tt ON t.type_id = tt.id
    LEFT JOIN terminal_allocations ta ON ta.session_id = s.id AND ta.is_active = 1
    WHERE s.status = 'active'
    ORDER BY s.id DESC
  `).all();
  return res.json(active);
});

// GET /api/v1/sessions/:id
router.get('/:id', authMiddleware, (req, res) => {
  const session = db.prepare(`
    SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
           t.terminal_number, tt.name as terminal_type_name
    FROM sessions s
    JOIN customers c ON s.customer_id = c.id
    JOIN terminals t ON s.terminal_id = t.id
    JOIN terminal_types tt ON t.type_id = tt.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!session) {
    return res.status(404).json({ detail: 'Session not found' });
  }

  const payment = db.prepare('SELECT * FROM payments WHERE session_id = ?').get(session.id);
  return res.json({ ...session, payment: payment || null });
});

// POST /api/v1/sessions/:id/end
router.post('/:id/end', authMiddleware, (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session || session.status !== 'active') {
    return res.status(400).json({ detail: 'Active session not found' });
  }

  const term = db.prepare(`
    SELECT t.*, tt.name as type_name 
    FROM terminals t 
    JOIN terminal_types tt ON t.type_id = tt.id 
    WHERE t.id = ?
  `).get(session.terminal_id);

  const rateRow = db.prepare('SELECT rate_per_unit FROM service_rates WHERE service_type = ?').get(term.type_name.toLowerCase());
  const hourlyRate = rateRow ? rateRow.rate_per_unit : 20.0;

  const now = new Date();
  const startTime = new Date(session.start_time);
  const actualMinutes = Math.max(1, Math.round((now.getTime() - startTime.getTime()) / 60000));
  const charge = Number(((actualMinutes / 60) * hourlyRate).toFixed(2));

  const endTx = db.transaction(() => {
    db.prepare(`
      UPDATE sessions 
      SET actual_end_time = ?, actual_duration_minutes = ?, status = 'completed', session_charge = ?
      WHERE id = ?
    `).run(now.toISOString(), actualMinutes, charge, session.id);

    db.prepare(`
      UPDATE terminal_allocations 
      SET is_active = 0, released_at = ?
      WHERE session_id = ? AND is_active = 1
    `).run(now.toISOString(), session.id);

    db.prepare("UPDATE terminals SET status = 'available' WHERE id = ?").run(session.terminal_id);
  });

  endTx();
  const updated = db.prepare('SELECT * FROM sessions WHERE id = ?').get(session.id);
  return res.json(updated);
});

module.exports = router;
