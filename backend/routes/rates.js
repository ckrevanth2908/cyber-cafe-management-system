const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// GET /api/v1/rates
router.get('/', (req, res) => {
  const rates = db.prepare('SELECT * FROM service_rates ORDER BY id ASC').all();
  return res.json(rates);
});

// PUT /api/v1/rates/:id
router.put('/:id', (req, res) => {
  const { rate_per_unit, description } = req.body;
  const existing = db.prepare('SELECT * FROM service_rates WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ detail: 'Rate not found' });
  }

  db.prepare(`
    UPDATE service_rates
    SET rate_per_unit = COALESCE(?, rate_per_unit),
        description = COALESCE(?, description),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(rate_per_unit, description, req.params.id);

  const updated = db.prepare('SELECT * FROM service_rates WHERE id = ?').get(req.params.id);
  return res.json(updated);
});

// PUT /api/v1/rates (Bulk Update) and /api/v1/rates/bulk
router.put('/', handleBulkUpdate);
router.put('/bulk', handleBulkUpdate);

function handleBulkUpdate(req, res) {
  const rates = req.body; // array of { id, rate_per_unit, description }
  if (!Array.isArray(rates)) {
    return res.status(400).json({ detail: 'Expected an array of rates' });
  }

  const updateStmt = db.prepare(`
    UPDATE service_rates
    SET rate_per_unit = COALESCE(?, rate_per_unit),
        description = COALESCE(?, description),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const transaction = db.transaction((items) => {
    for (const item of items) {
      updateStmt.run(item.rate_per_unit, item.description, item.id);
    }
  });

  transaction(rates);
  const allRates = db.prepare('SELECT * FROM service_rates ORDER BY id ASC').all();
  return res.json(allRates);
}

module.exports = router;
