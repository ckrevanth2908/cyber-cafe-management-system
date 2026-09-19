const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

function calculateSessionCharge(durationMinutes, ratePerHour) {
  return Number(((durationMinutes / 60) * ratePerHour).toFixed(2));
}

// POST /api/v1/allocations
router.post('/', authMiddleware, (req, res) => {
  const customerId = req.body.customer_id || req.body.customerId;
  let terminalTypeId = req.body.terminal_type_id || req.body.terminalTypeId;
  const durationMinutes = parseInt(req.body.duration_minutes || req.body.durationMinutes || req.body.duration || req.body.expectedDurationMinutes || 60, 10);
  let terminalId = req.body.terminal_id || req.body.terminalId;
  const systemType = (req.body.system_type || req.body.systemType || '').toLowerCase();

  if (!customerId) {
    return res.status(400).json({ detail: 'Please select a customer' });
  }

  // Resolve terminal type ID if systemType name provided
  if (!terminalTypeId && systemType) {
    const typeRow = db.prepare('SELECT id FROM terminal_types WHERE LOWER(name) = ?').get(systemType);
    if (typeRow) {
      terminalTypeId = typeRow.id;
    }
  }

  // If specific terminal provided, get its type ID
  if (terminalId && !terminalTypeId) {
    const termRow = db.prepare('SELECT type_id FROM terminals WHERE id = ?').get(terminalId);
    if (termRow) {
      terminalTypeId = termRow.type_id;
    }
  }

  if (!terminalTypeId) {
    // Default to first terminal type (Browsing)
    const firstType = db.prepare('SELECT id FROM terminal_types LIMIT 1').get();
    terminalTypeId = firstType ? firstType.id : 1;
  }

  // Check customer existence
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) {
    return res.status(404).json({ detail: 'Selected customer was not found' });
  }

  const termType = db.prepare('SELECT * FROM terminal_types WHERE id = ?').get(terminalTypeId);
  if (!termType) {
    return res.status(404).json({ detail: 'Terminal type not found' });
  }

  // Age restriction check for Gaming
  const config = db.prepare('SELECT age_restriction_gaming FROM system_config LIMIT 1').get();
  if (termType.name.toLowerCase() === 'gaming' && config && config.age_restriction_gaming) {
    if (customer.age < config.age_restriction_gaming) {
      return res.status(400).json({
        detail: `Customer age (${customer.age}) is below the required age (${config.age_restriction_gaming}) for Gaming terminals.`
      });
    }
  }

  // Find suitable available terminal
  let term;
  if (terminalId) {
    term = db.prepare('SELECT * FROM terminals WHERE id = ? AND status = ?').get(terminalId, 'available');
  } else {
    term = db.prepare('SELECT * FROM terminals WHERE type_id = ? AND status = ? ORDER BY terminal_number ASC LIMIT 1').get(terminalTypeId, 'available');
  }

  if (!term) {
    return res.status(400).json({ detail: `No available ${termType.name} terminals. You can add the customer to the waiting queue.` });
  }

  // Get hourly rate
  const rateRow = db.prepare('SELECT rate_per_unit FROM service_rates WHERE service_type = ?').get(termType.name.toLowerCase());
  const hourlyRate = rateRow ? rateRow.rate_per_unit : 20.0;

  const startTime = new Date();
  const expectedEndTime = new Date(startTime.getTime() + durationMinutes * 60000);

  // Atomic Allocation Transaction
  const allocateTx = db.transaction(() => {
    // 1. Create Session
    const sessionRes = db.prepare(`
      INSERT INTO sessions (customer_id, terminal_id, start_time, expected_end_time, expected_duration_minutes, status, session_charge)
      VALUES (?, ?, ?, ?, ?, 'active', 0)
    `).run(customerId, term.id, startTime.toISOString(), expectedEndTime.toISOString(), durationMinutes);

    const sessionId = sessionRes.lastInsertRowid;

    // 2. Mark Terminal as Occupied
    db.prepare("UPDATE terminals SET status = 'occupied' WHERE id = ?").run(term.id);

    // 3. Create Allocation record
    const allocRes = db.prepare(`
      INSERT INTO terminal_allocations (terminal_id, session_id, customer_id, allocated_at, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(term.id, sessionId, customerId, startTime.toISOString());

    // 4. Mark queue entry as allocated if existing
    db.prepare("UPDATE waiting_queue SET status = 'allocated' WHERE customer_id = ? AND terminal_type_id = ? AND status = 'waiting'").run(customerId, terminalTypeId);

    return {
      id: allocRes.lastInsertRowid,
      terminal_id: term.id,
      session_id: sessionId,
      customer_id: customerId,
      terminal_number: term.terminal_number,
      terminal_type_name: termType.name,
      customer_name: customer.name,
      start_time: startTime.toISOString(),
      expected_end_time: expectedEndTime.toISOString(),
      expected_duration_minutes: durationMinutes,
      hourly_rate: hourlyRate,
      status: 'active'
    };
  });

  try {
    const allocation = allocateTx();
    return res.status(201).json(allocation);
  } catch (err) {
    console.error('Allocation error:', err);
    return res.status(500).json({ detail: 'Failed to allocate terminal: ' + err.message });
  }
});

// GET /api/v1/allocations/active
router.get('/active', authMiddleware, (req, res) => {
  const activeAllocations = db.prepare(`
    SELECT ta.*, t.terminal_number, tt.name as terminal_type_name, c.name as customer_name,
           s.start_time, s.expected_end_time, s.expected_duration_minutes
    FROM terminal_allocations ta
    JOIN terminals t ON ta.terminal_id = t.id
    JOIN terminal_types tt ON t.type_id = tt.id
    JOIN customers c ON ta.customer_id = c.id
    JOIN sessions s ON ta.session_id = s.id
    WHERE ta.is_active = 1
    ORDER BY ta.id DESC
  `).all();
  return res.json(activeAllocations);
});

// POST /api/v1/allocations/:id/release
router.post('/:id/release', authMiddleware, (req, res) => {
  const alloc = db.prepare('SELECT * FROM terminal_allocations WHERE id = ?').get(req.params.id);
  if (!alloc || !alloc.is_active) {
    return res.status(404).json({ detail: 'Active allocation not found' });
  }

  const now = new Date();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(alloc.session_id);
  const term = db.prepare('SELECT t.*, tt.name as type_name FROM terminals t JOIN terminal_types tt ON t.type_id = tt.id WHERE t.id = ?').get(alloc.terminal_id);
  const rateRow = db.prepare('SELECT rate_per_unit FROM service_rates WHERE service_type = ?').get(term.type_name.toLowerCase());
  const hourlyRate = rateRow ? rateRow.rate_per_unit : 20.0;

  const startTime = new Date(session.start_time);
  const actualMinutes = Math.max(1, Math.round((now.getTime() - startTime.getTime()) / 60000));
  const charge = calculateSessionCharge(actualMinutes, hourlyRate);

  const releaseTx = db.transaction(() => {
    db.prepare(`
      UPDATE sessions 
      SET actual_end_time = ?, actual_duration_minutes = ?, status = 'completed', session_charge = ?
      WHERE id = ?
    `).run(now.toISOString(), actualMinutes, charge, session.id);

    db.prepare(`
      UPDATE terminal_allocations 
      SET is_active = 0, released_at = ?
      WHERE id = ?
    `).run(now.toISOString(), alloc.id);

    db.prepare("UPDATE terminals SET status = 'available' WHERE id = ?").run(alloc.terminal_id);
  });

  releaseTx();
  return res.json({ detail: 'Terminal released and session ended successfully', session_id: session.id, charge });
});

module.exports = router;
