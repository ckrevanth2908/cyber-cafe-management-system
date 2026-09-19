const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

function recordRevenue(serviceType, amount) {
  const today = new Date().toISOString().slice(0, 10);
  let record = db.prepare('SELECT * FROM daily_revenue WHERE date = ?').get(today);
  if (!record) {
    db.prepare('INSERT INTO daily_revenue (date) VALUES (?)').run(today);
  }

  const colMap = {
    plain_print: 'plain_print_revenue',
    colour_print: 'colour_print_revenue',
    xerox: 'xerox_revenue'
  };

  const col = colMap[serviceType] || 'plain_print_revenue';
  db.prepare(`
    UPDATE daily_revenue 
    SET ${col} = ${col} + ?,
        total_revenue = total_revenue + ?,
        num_print_transactions = num_print_transactions + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE date = ?
  `).run(amount, amount, today);
}

// GET /api/v1/printing
router.get('/', (req, res) => {
  try {
    const { customer_id, service_type } = req.query;
    let query = `
      SELECT pt.*, c.name as customer_name, c.phone as customer_phone,
             p.name as printer_name
      FROM print_transactions pt
      JOIN customers c ON pt.customer_id = c.id
      LEFT JOIN printers p ON pt.printer_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (customer_id) {
      query += ' AND pt.customer_id = ?';
      params.push(customer_id);
    }
    if (service_type) {
      query += ' AND pt.service_type = ?';
      params.push(service_type);
    }

    query += ' ORDER BY pt.id DESC';
    const transactions = db.prepare(query).all(...params);
    return res.json(transactions);
  } catch (err) {
    console.error('[printing GET]', err.message);
    return res.status(500).json({ detail: err.message });
  }
});

// POST /api/v1/printing
router.post('/', (req, res) => {
  try {
    const { customer_id, customerId, printer_id, printerId, service_type, serviceType, num_pages, pages, notes } = req.body;
    const finalCustId = customer_id || customerId;
    const finalType = service_type || serviceType || 'plain_print';
    const finalPages = parseInt(num_pages || pages || 1, 10);
    const finalPrinterId = printer_id || printerId || null;

    if (!finalCustId || !finalType || finalPages <= 0) {
      return res.status(400).json({ detail: 'Valid customer, service type, and page count are required' });
    }

    const rateRow = db.prepare('SELECT rate_per_unit FROM service_rates WHERE service_type = ?').get(finalType);
    const costPerPage = rateRow ? rateRow.rate_per_unit : (finalType === 'colour_print' ? 10.0 : finalType === 'xerox' ? 1.0 : 2.0);
    const totalAmount = Number((costPerPage * finalPages).toFixed(2));

    const result = db.prepare(`
      INSERT INTO print_transactions (customer_id, printer_id, service_type, num_pages, cost_per_page, total_amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(finalCustId, finalPrinterId, finalType, finalPages, costPerPage, totalAmount, notes || '');

    recordRevenue(finalType, totalAmount);

    const tx = db.prepare(`
      SELECT pt.*, c.name as customer_name, p.name as printer_name
      FROM print_transactions pt
      JOIN customers c ON pt.customer_id = c.id
      LEFT JOIN printers p ON pt.printer_id = p.id
      WHERE pt.id = ?
    `).get(result.lastInsertRowid);

    return res.status(201).json(tx);
  } catch (err) {
    console.error('[printing POST]', err.message);
    return res.status(500).json({ detail: err.message });
  }
});

module.exports = router;
