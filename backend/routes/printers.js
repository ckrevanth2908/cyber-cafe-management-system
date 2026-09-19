const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET /api/v1/printers
router.get('/', authMiddleware, (req, res) => {
  const printers = db.prepare('SELECT * FROM printers ORDER BY id ASC').all();
  return res.json(printers);
});

// POST /api/v1/printers
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { name, printer_type, specifications, is_active } = req.body;
  if (!name || !printer_type) {
    return res.status(400).json({ detail: 'Printer name and type are required' });
  }

  const result = db.prepare(`
    INSERT INTO printers (name, printer_type, specifications, is_active)
    VALUES (?, ?, ?, ?)
  `).run(name, printer_type, specifications || '', is_active !== undefined ? (is_active ? 1 : 0) : 1);

  const printer = db.prepare('SELECT * FROM printers WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(printer);
});

// PUT /api/v1/printers/:id
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { name, printer_type, specifications, is_active } = req.body;
  const existing = db.prepare('SELECT id FROM printers WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ detail: 'Printer not found' });
  }

  db.prepare(`
    UPDATE printers
    SET name = COALESCE(?, name),
        printer_type = COALESCE(?, printer_type),
        specifications = COALESCE(?, specifications),
        is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(name, printer_type, specifications, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);

  const updated = db.prepare('SELECT * FROM printers WHERE id = ?').get(req.params.id);
  return res.json(updated);
});

// DELETE /api/v1/printers/:id
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const existing = db.prepare('SELECT id FROM printers WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ detail: 'Printer not found' });
  }

  db.prepare('DELETE FROM printers WHERE id = ?').run(req.params.id);
  return res.json({ detail: 'Printer deleted successfully' });
});

module.exports = router;
