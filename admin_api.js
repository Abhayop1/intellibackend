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
        revenue: row.revenue ? row.revenue.toFixed(2) : '0.00',
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
        value: statsRows[0].total_revenue ? statsRows[0].total_revenue.toFixed(2) : '0.00',
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