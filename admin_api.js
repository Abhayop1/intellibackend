const express = require('express');
const pool = require('./db');
const verifyToken = require('./auth');
const { restrictTo } = require('./authMiddleware');

const router = express.Router();

// Get all users for admin management
router.get('/users', verifyToken, restrictTo('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT 
        id, name, email, role, created_at AS join_date,
        (SELECT MAX(created_at) FROM public.security_events 
         WHERE type = 'login_success' AND message LIKE '%' || u.email || '%') AS last_login
      FROM public.users u
      ORDER BY created_at DESC
      `
    );

    res.json({
      success: true,
      users: rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        status: row.last_login ? 'active' : 'inactive', // Assume active if logged in
        lastLogin: row.last_login,
        joinDate: row.join_date,
      })),
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Delete a user by ID (admin only)
router.delete('/users/:id', verifyToken, restrictTo('admin'), async (req, res) => {
  const userId = req.params.id;
  try {
    // Optionally, you can check if the user exists first
    await pool.query('DELETE FROM public.users WHERE id = $1', [userId]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

// Update a user by ID (admin only)
router.put('/users/:id', verifyToken, restrictTo('admin'), async (req, res) => {
  const userId = req.params.id;
  const { name, email, role, status } = req.body;
  const updates = [];
  const values = [];
  let paramCount = 1;
  if (name) { updates.push(`name = $${paramCount++}`); values.push(name); }
  if (email) { updates.push(`email = $${paramCount++}`); values.push(email); }
  if (role) { updates.push(`role = $${paramCount++}`); values.push(role); }
  if (status) { updates.push(`status = $${paramCount++}`); values.push(status); }
  if (updates.length === 0) {
    return res.status(400).json({ success: false, error: 'No fields to update' });
  }
  values.push(userId);
  const query = `UPDATE public.users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
  try {
    const { rows } = await pool.query(query, values);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// Get all services for admin oversight
router.get('/services', verifyToken, restrictTo('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT 
        s.id, s.name, sp.company_name AS provider, 
        s.status, s.users_count, s.revenue
      FROM public.services s
      JOIN public.service_providers sp ON s.provider_id = sp.id
      ORDER BY s.created_at DESC
      `
    );

    res.json({
      success: true,
      services: rows.map(row => ({
        id: row.id,
        name: row.name,
        provider: row.company_name,
        status: row.status,
        users: row.users_count,
        revenue: typeof row.revenue === 'number' ? row.revenue.toFixed(2) : (parseFloat(row.revenue) ? Number(row.revenue).toFixed(2) : '0.00'),
      })),
    });
  } catch (err) {
    console.error('Error fetching services:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch services',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Get system-wide statistics
router.get('/stats', verifyToken, restrictTo('admin'), async (req, res) => {
  try {
    const { rows: statsRows } = await pool.query(
      `
      SELECT 
        (SELECT COUNT(*) FROM public.users) AS total_users,
        (SELECT COUNT(*) FROM public.services) AS total_services,
        (SELECT COUNT(*) FROM public.user_configurations WHERE status = 'active') AS active_configurations,
        (SELECT SUM(revenue) FROM public.services) AS total_revenue
      `
    );

    const stats = [
      {
        label: 'Total Users',
        value: statsRows[0].total_users.toString(),
        change: '+0', // Placeholder: Implement logic for change if needed
        trend: 'stable',
      },
      {
        label: 'Total Services',
        value: statsRows[0].total_services.toString(),
        change: '+0', // Placeholder
        trend: 'stable',
      },
      {
        label: 'Active Configurations',
        value: statsRows[0].active_configurations.toString(),
        change: '+0', // Placeholder
        trend: 'stable',
      },
      {
        label: 'Total Revenue',
        value: (statsRows[0].total_revenue !== null && statsRows[0].total_revenue !== undefined)
          ? Number(statsRows[0].total_revenue).toFixed(2)
          : '0.00',
        change: '+0', // Placeholder
        trend: 'stable',
      },
    ];

    res.json({
      success: true,
      stats,
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Get security events and alerts
router.get('/security-events', verifyToken, restrictTo('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT id, type, message, severity, created_at AS time
      FROM public.security_events
      ORDER BY created_at DESC
      LIMIT 50
      `
    );

    res.json({
      success: true,
      events: rows.map(row => ({
        id: row.id,
        type: row.type,
        message: row.message,
        time: row.time,
        severity: row.severity,
      })),
    });
  } catch (err) {
    console.error('Error fetching security events:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security events',
      code: 'INTERNAL_ERROR',
    });
  }
});

module.exports = router;