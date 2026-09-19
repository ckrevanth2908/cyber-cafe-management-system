const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET /api/v1/terminals
router.get('/', authMiddleware, (req, res) => {
  const { type_id, status } = req.query;
  let query = `
    SELECT t.*, tt.name as type_name, tt.description as type_description
    FROM terminals t
    JOIN terminal_types tt ON t.type_id = tt.id
    WHERE 1=1
  `;
  const params = [];

  if (type_id) {
    query += ' AND t.type_id = ?';
    params.push(type_id);
  }
  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }

  query += ' ORDER BY t.terminal_number ASC';
  const terminals = db.prepare(query).all(...params);

  // Attach active session if occupied
  const result = terminals.map(term => {
    if (term.status === 'occupied') {
      const activeSession = db.prepare(`
        SELECT s.*, c.name as customer_name
        FROM sessions s
        JOIN customers c ON s.customer_id = c.id
        WHERE s.terminal_id = ? AND s.status = 'active'
        LIMIT 1
      `).get(term.id);
      return { ...term, current_session: activeSession || null };
    }
    return { ...term, current_session: null };
  });

  return res.json(result);
});

// GET /api/v1/terminals/types
router.get('/types', authMiddleware, (req, res) => {
  const types = db.prepare('SELECT * FROM terminal_types ORDER BY id ASC').all();
  return res.json(types);
});

// GET /api/v1/terminals/status-summary
router.get('/status-summary', authMiddleware, (req, res) => {
  const types = db.prepare('SELECT * FROM terminal_types').all();
  const summary = {};

  for (const t of types) {
    const total = db.prepare('SELECT COUNT(*) as count FROM terminals WHERE type_id = ?').get(t.id).count;
    const available = db.prepare("SELECT COUNT(*) as count FROM terminals WHERE type_id = ? AND status = 'available'").get(t.id).count;
    const occupied = db.prepare("SELECT COUNT(*) as count FROM terminals WHERE type_id = ? AND status = 'occupied'").get(t.id).count;
    const maintenance = db.prepare("SELECT COUNT(*) as count FROM terminals WHERE type_id = ? AND status = 'maintenance'").get(t.id).count;

    summary[t.name] = { total, available, occupied, maintenance };
  }

  return res.json(summary);
});

// POST /api/v1/terminals
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { terminal_number, type_id, specifications } = req.body;
  if (!terminal_number || !type_id) {
    return res.status(400).json({ detail: 'Terminal number and type are required' });
  }

  const existing = db.prepare('SELECT id FROM terminals WHERE terminal_number = ?').get(terminal_number);
  if (existing) {
    return res.status(400).json({ detail: 'Terminal number already exists' });
  }

  const result = db.prepare(`
    INSERT INTO terminals (terminal_number, type_id, specifications, status)
    VALUES (?, ?, ?, 'available')
  `).run(terminal_number, type_id, specifications || '');

  const terminal = db.prepare(`
    SELECT t.*, tt.name as type_name
    FROM terminals t
    JOIN terminal_types tt ON t.type_id = tt.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  return res.status(201).json(terminal);
});

// PUT /api/v1/terminals/:id
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { terminal_number, type_id, specifications, status } = req.body;
  const existing = db.prepare('SELECT * FROM terminals WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ detail: 'Terminal not found' });
  }

  db.prepare(`
    UPDATE terminals
    SET terminal_number = COALESCE(?, terminal_number),
        type_id = COALESCE(?, type_id),
        specifications = COALESCE(?, specifications),
        status = COALESCE(?, status)
    WHERE id = ?
  `).run(terminal_number, type_id, specifications, status, req.params.id);

  const updated = db.prepare(`
    SELECT t.*, tt.name as type_name
    FROM terminals t
    JOIN terminal_types tt ON t.type_id = tt.id
    WHERE t.id = ?
  `).get(req.params.id);

  return res.json(updated);
});

// PUT /api/v1/terminals/:id/status
router.put('/:id/status', authMiddleware, updateTerminalStatus);
router.patch('/:id/status', authMiddleware, updateTerminalStatus);

function updateTerminalStatus(req, res) {
  const { status } = req.body;
  if (!['available', 'occupied', 'maintenance'].includes(status)) {
    return res.status(400).json({ detail: 'Invalid status' });
  }

  const existing = db.prepare('SELECT * FROM terminals WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ detail: 'Terminal not found' });
  }

  if (existing.status === 'occupied' && status === 'maintenance') {
    return res.status(400).json({ detail: 'Cannot put occupied terminal into maintenance' });
  }

  db.prepare('UPDATE terminals SET status = ? WHERE id = ?').run(status, req.params.id);
  const updated = db.prepare('SELECT * FROM terminals WHERE id = ?').get(req.params.id);
  return res.json(updated);
}

// DELETE /api/v1/terminals/:id
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const existing = db.prepare('SELECT * FROM terminals WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ detail: 'Terminal not found' });
  }
  if (existing.status === 'occupied') {
    return res.status(400).json({ detail: 'Cannot delete an occupied terminal' });
  }

  db.prepare('DELETE FROM terminals WHERE id = ?').run(req.params.id);
  return res.json({ detail: 'Terminal deleted successfully' });
});

module.exports = router;
