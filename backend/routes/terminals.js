const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// GET /api/v1/terminals
router.get('/', (req, res) => {
  try {
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

    // Attach active session if occupied, and auto-heal orphaned occupied terminals
    const result = terminals.map(term => {
      if (term.status === 'occupied') {
        const activeSession = db.prepare(`
          SELECT s.*, c.name as customer_name
          FROM sessions s
          JOIN customers c ON s.customer_id = c.id
          WHERE s.terminal_id = ? AND s.status = 'active'
          LIMIT 1
        `).get(term.id);

        if (!activeSession) {
          // Self-heal: No active session exists, mark available in DB!
          db.prepare("UPDATE terminals SET status = 'available' WHERE id = ?").run(term.id);
          return { ...term, status: 'available', current_session: null };
        }
        return { ...term, current_session: activeSession };
      }
      return { ...term, current_session: null };
    });

    return res.json(result);
  } catch (err) {
    console.error('[terminals GET]', err.message);
    return res.status(500).json({ detail: err.message });
  }
});

// GET /api/v1/terminals/types
router.get('/types', (req, res) => {
  try {
    const types = db.prepare('SELECT * FROM terminal_types ORDER BY id ASC').all();
    return res.json(types);
  } catch (err) {
    console.error('[terminals/types]', err.message);
    return res.status(500).json({ detail: err.message });
  }
});

// GET /api/v1/terminals/status-summary
router.get('/status-summary', (req, res) => {
  try {
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
  } catch (err) {
    console.error('[terminals/status-summary]', err.message);
    return res.status(500).json({ detail: err.message });
  }
});

// POST /api/v1/terminals
router.post('/', (req, res) => {
  try {
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
  } catch (err) {
    console.error('[terminals POST]', err.message);
    return res.status(500).json({ detail: err.message });
  }
});

// PUT /api/v1/terminals/:id
router.put('/:id', (req, res) => {
  try {
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
  } catch (err) {
    console.error('[terminals/:id PUT]', err.message);
    return res.status(500).json({ detail: err.message });
  }
});

// PUT /api/v1/terminals/:id/status
router.put('/:id/status', updateTerminalStatus);
router.patch('/:id/status', updateTerminalStatus);

function updateTerminalStatus(req, res) {
  try {
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
  } catch (err) {
    console.error('[terminals/:id/status]', err.message);
    return res.status(500).json({ detail: err.message });
  }
}

// POST /api/v1/terminals/:id/free
// POST /api/v1/terminals/:id/release
router.post('/:id/free', freeTerminalHandler);
router.post('/:id/release', freeTerminalHandler);

function freeTerminalHandler(req, res) {
  try {
    const terminalId = req.params.id;
    const term = db.prepare('SELECT t.*, tt.name as type_name FROM terminals t JOIN terminal_types tt ON t.type_id = tt.id WHERE t.id = ?').get(terminalId);
    if (!term) {
      return res.status(404).json({ detail: 'Terminal not found' });
    }

    const activeSession = db.prepare("SELECT * FROM sessions WHERE terminal_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").get(terminalId);
    const now = new Date();

    const freeTx = db.transaction(() => {
      if (activeSession) {
        const rateRow = db.prepare('SELECT rate_per_unit FROM service_rates WHERE service_type = ?').get(term.type_name.toLowerCase());
        const hourlyRate = rateRow ? rateRow.rate_per_unit : 20.0;
        const startTime = new Date(activeSession.start_time);
        const actualMinutes = Math.max(1, Math.round((now.getTime() - startTime.getTime()) / 60000));
        const charge = Number(((actualMinutes / 60) * hourlyRate).toFixed(2));

        db.prepare(`
          UPDATE sessions 
          SET actual_end_time = ?, actual_duration_minutes = ?, status = 'completed', session_charge = ?
          WHERE id = ?
        `).run(now.toISOString(), actualMinutes, charge, activeSession.id);

        db.prepare(`
          UPDATE terminal_allocations 
          SET is_active = 0, released_at = ?
          WHERE (terminal_id = ? OR session_id = ?) AND is_active = 1
        `).run(now.toISOString(), terminalId, activeSession.id);
      }

      db.prepare("UPDATE terminals SET status = 'available' WHERE id = ?").run(terminalId);
    });

    freeTx();
    const updated = db.prepare('SELECT * FROM terminals WHERE id = ?').get(terminalId);
    return res.json({ message: 'Terminal freed and seat occupancy revoked successfully', terminal: updated, session_ended: activeSession?.id || null });
  } catch (err) {
    console.error('[terminals/:id/free]', err.message);
    return res.status(500).json({ detail: err.message });
  }
}

// DELETE /api/v1/terminals/:id
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM terminals WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ detail: 'Terminal not found' });
    }
    if (existing.status === 'occupied') {
      return res.status(400).json({ detail: 'Cannot delete an occupied terminal' });
    }

    db.prepare('DELETE FROM terminals WHERE id = ?').run(req.params.id);
    return res.json({ detail: 'Terminal deleted successfully' });
  } catch (err) {
    console.error('[terminals/:id DELETE]', err.message);
    return res.status(500).json({ detail: err.message });
  }
});

module.exports = router;
