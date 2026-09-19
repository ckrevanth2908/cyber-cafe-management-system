const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

// Helper to calculate session charges
function calculateSessionCharge(durationMinutes, ratePerHour) {
  return Number(((durationMinutes / 60) * ratePerHour).toFixed(2));
}

// POST /api/v1/allocations
router.post('/', authMiddleware, (req, res) => {
  const { customer_id, terminal_type_id, duration_minutes, terminal_id } = req.body;
  if (!customer_id || !terminal_type_id || !duration_minutes) {
    return res.status(400).json({ detail: 'Customer, system type, and expected duration are required' });
  }

  // Check customer age restriction if gaming
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
  if (!customer) {
    return res.status(404).json({ detail: 'Customer not found' });
  }

  const termType = db.prepare('SELECT * FROM terminal_types WHERE id = ?').get(terminal_type_id);
  if (!termType) {
    return res.status(404).json({ detail: 'Terminal type not found' });
  }

  const config = db.prepare('SELECT age_restriction_gaming FROM system_config LIMIT 1').get();
  if (termType.name.toLowerCase() === 'gaming' && config && config.age_restriction_gaming) {
    if (customer.age < config.age_restriction_gaming) {
      return res.status(400).json({
        detail: `Customer age (${customer.age}) is below the required age (${config.age_restriction_gaming}) for Gaming terminals.`
      });
    }
  }

  // Find available terminal
  let term;
  if (terminal_id) {
    term = db.prepare('SELECT * FROM terminals WHERE id = ? AND status = ?').get(terminal_id, 'available');
  } else {
    term = db.prepare('SELECT * FROM terminals WHERE type_id = ? AND status = ? ORDER BY id ASC LIMIT 1').get(terminal_type_id, 'available');
  }

  if (!term) {
    return res.status(400).json({ detail: 'No available terminals for the selected type' });
  }

  // Get rate
  const rateRow = db.prepare('SELECT rate_per_unit FROM service_rates WHERE service_type = ?').get(termType.name.toLowerCase());
  const hourlyRate = rateRow ? rateRow.rate_per_unit : 20.0;

  const startTime = new Date();
  const expectedEndTime = new Date(startTime.getTime() + duration_minutes * 60000);

  // DB Transaction for atomic allocation
  const allocateTx = db.transaction(() => {
    // 1. Create Session
    const sessionRes = db.prepare(`
      INSERT INTO sessions (customer_id, terminal_id, start_time, expected_end_time, expected_duration_minutes, status, session_charge)
      VALUES (?, ?, ?, ?, ?, 'active', 0)
    `).run(customer_id, term.id, startTime.toISOString(), expectedEndTime.toISOString(), duration_minutes);

    const sessionId = sessionRes.lastInsertRowid;

    // 2. Mark terminal as occupied
    db.prepare("UPDATE terminals SET status = 'occupied' WHERE id = ?").run(term.id);

    // 3. Create Terminal Allocation record
    const allocRes = db.prepare(`
      INSERT INTO terminal_allocations (terminal_id, session_id, customer_id, allocated_at, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(term.id, sessionId, customer_id, startTime.toISOString());

    // 4. If customer was in waiting queue, mark as allocated
    db.prepare("UPDATE waiting_queue SET status = 'allocated' WHERE customer_id = ? AND terminal_type_id = ? AND status = 'waiting'").run(customer_id, terminal_type_id);

    return {
      id: allocRes.lastInsertRowid,
      terminal_id: term.id,
      session_id: sessionId,
      customer_id: customer_id,
      terminal_number: term.terminal_number,
      terminal_type_name: termType.name,
      customer_name: customer.name,
      start_time: startTime.toISOString(),
      expected_end_time: expectedEndTime.toISOString(),
      expected_duration_minutes: duration_minutes,
      hourly_rate: hourlyRate,
      status: 'active'
    };
  });

  try {
    const allocation = allocateTx();
    return res.status(201).json(allocation);
  } catch (err) {
    console.error('Allocation error:', err);
    return res.status(500).json({ detail: 'Failed to allocate terminal' });
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
    // 1. End session
    db.prepare(`
      UPDATE sessions 
      SET actual_end_time = ?, actual_duration_minutes = ?, status = 'completed', session_charge = ?
      WHERE id = ?
    `).run(now.toISOString(), actualMinutes, charge, session.id);

    // 2. Mark allocation inactive
    db.prepare(`
      UPDATE terminal_allocations 
      SET is_active = 0, released_at = ?
      WHERE id = ?
    `).run(now.toISOString(), alloc.id);

    // 3. Mark terminal available
    db.prepare("UPDATE terminals SET status = 'available' WHERE id = ?").run(alloc.terminal_id);
  });

  releaseTx();
  return res.json({ detail: 'Terminal released and session ended successfully', session_id: session.id, charge });
});

module.exports = router;
