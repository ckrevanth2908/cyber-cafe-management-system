const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// GET /api/v1/queue
router.get('/', (req, res) => {
  try {
    const queue = db.prepare(`
      SELECT q.*, c.name as customer_name, c.phone as customer_phone,
             tt.name as terminal_type_name
      FROM waiting_queue q
      JOIN customers c ON q.customer_id = c.id
      JOIN terminal_types tt ON q.terminal_type_id = tt.id
      WHERE q.status = 'waiting'
      ORDER BY q.priority DESC, q.id ASC
    `).all();

    // Calculate estimated wait time based on earliest ending active session for that type
    const result = queue.map((item, index) => {
      const earliestSession = db.prepare(`
        SELECT MIN(s.expected_end_time) as min_end
        FROM sessions s
        JOIN terminals t ON s.terminal_id = t.id
        WHERE t.type_id = ? AND s.status = 'active'
      `).get(item.terminal_type_id);

      let estimatedWaitMinutes = 15 * (index + 1);
      if (earliestSession && earliestSession.min_end) {
        const now = new Date();
        const endTime = new Date(earliestSession.min_end);
        const diffMinutes = Math.max(1, Math.round((endTime.getTime() - now.getTime()) / 60000));
        estimatedWaitMinutes = diffMinutes + (index * 15);
      }

      return {
        ...item,
        position: index + 1,
        estimated_wait_minutes: estimatedWaitMinutes
      };
    });

    return res.json(result);
  } catch (err) {
    console.error('[queue GET]', err.message);
    return res.status(500).json({ detail: err.message });
  }
});

// POST /api/v1/queue
router.post('/', (req, res) => {
  try {
    const { customer_id, terminal_type_id, expected_duration_minutes, priority } = req.body;
    if (!customer_id || !terminal_type_id || !expected_duration_minutes) {
      return res.status(400).json({ detail: 'Customer, system type, and duration are required' });
    }

    // Check if customer already in queue
    const existing = db.prepare("SELECT id FROM waiting_queue WHERE customer_id = ? AND status = 'waiting'").get(customer_id);
    if (existing) {
      return res.status(400).json({ detail: 'Customer is already in the waiting queue' });
    }

    const result = db.prepare(`
      INSERT INTO waiting_queue (customer_id, terminal_type_id, expected_duration_minutes, priority, status)
      VALUES (?, ?, ?, ?, 'waiting')
    `).run(customer_id, terminal_type_id, expected_duration_minutes, priority || 0);

    const item = db.prepare(`
      SELECT q.*, c.name as customer_name, tt.name as terminal_type_name
      FROM waiting_queue q
      JOIN customers c ON q.customer_id = c.id
      JOIN terminal_types tt ON q.terminal_type_id = tt.id
      WHERE q.id = ?
    `).get(result.lastInsertRowid);

    return res.status(201).json(item);
  } catch (err) {
    console.error('[queue POST]', err.message);
    return res.status(500).json({ detail: err.message });
  }
});

// DELETE /api/v1/queue/:id & POST /api/v1/queue/:id/cancel
router.delete('/:id', handleCancelQueue);
router.post('/:id/cancel', handleCancelQueue);

function handleCancelQueue(req, res) {
  try {
    const existing = db.prepare('SELECT id FROM waiting_queue WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ detail: 'Queue entry not found' });
    }

    db.prepare("UPDATE waiting_queue SET status = 'cancelled' WHERE id = ?").run(req.params.id);
    return res.json({ detail: 'Queue entry cancelled successfully' });
  } catch (err) {
    console.error('[queue cancel]', err.message);
    return res.status(500).json({ detail: err.message });
  }
}

module.exports = router;
