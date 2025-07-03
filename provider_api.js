const express = require('express');
const pool = require('./db');
const verifyToken = require('./auth');
const { restrictTo } = require('./authMiddleware');

const router = express.Router();

// Get service provider company information
router.get('/company-info', verifyToken, restrictTo('service_provider'), async (req, res) => {
  try {
    console.log('Decoded user:', req.user);
    const { rows } = await pool.query(
      `
      SELECT 
        id, company_name, website, business_license, 
        service_types, description, logo_url
      FROM public.service_providers
      WHERE user_id = $1
      `,
      [req.user.id]
    );
    console.log('Provider rows:', rows);

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Service provider not found',
        code: 'NOT_FOUND',
      });
    }

    res.json({
      success: true,
      company: {
        id: rows[0].id,
        companyName: rows[0].company_name,
        website: rows[0].website,
        businessLicense: rows[0].business_license,
        serviceTypes: rows[0].service_types || [],
        description: rows[0].description,
        logoUrl: rows[0].logo_url,
      },
    });
  } catch (err) {
    console.error('Error fetching company info:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company info',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Get service provider statistics
router.get('/stats', verifyToken, restrictTo('service_provider'), async (req, res) => {
  try {
    const { rows: providerRows } = await pool.query(
      `
      SELECT id FROM public.service_providers WHERE user_id = $1
      `,
      [req.user.id]
    );

    if (!providerRows.length) {
      return res.status(404).json({
        success: false,
        error: 'Service provider not found',
        code: 'NOT_FOUND',
      });
    }

    const providerId = providerRows[0].id;

    const { rows: serviceRows } = await pool.query(
      `
      SELECT 
        COUNT(*) AS total_services,
        SUM(users_count) AS total_users,
        SUM(revenue) AS total_revenue
      FROM public.services
      WHERE provider_id = $1
      `,
      [providerId]
    );

    const stats = [
      {
        label: 'Total Services',
        value: serviceRows[0].total_services,
        change: '+0', // Placeholder: Implement logic for change if needed
        trend: 'stable',
      },
      {
        label: 'Total Users',
        value: serviceRows[0].total_users || '0',
        change: '+0', // Placeholder
        trend: 'stable',
      },
      {
        label: 'Total Revenue',
        value: serviceRows[0].total_revenue !== null && serviceRows[0].total_revenue !== undefined
          ? Number(serviceRows[0].total_revenue).toFixed(2)
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

// Get provider's recently created services
router.get('/recent-services', verifyToken, restrictTo('service_provider'), async (req, res) => {
  try {
    const { rows: providerRows } = await pool.query(
      `
      SELECT id FROM public.service_providers WHERE user_id = $1
      `,
      [req.user.id]
    );

    if (!providerRows.length) {
      return res.status(404).json({
        success: false,
        error: 'Service provider not found',
        code: 'NOT_FOUND',
      });
    }

    const providerId = providerRows[0].id;

    const { rows } = await pool.query(
      `
      SELECT 
        id, name, status, users_count, revenue, created_at
      FROM public.services
      WHERE provider_id = $1
      ORDER BY created_at DESC
      LIMIT 10
      `,
      [providerId]
    );

    res.json({
      success: true,
      services: rows.map(row => ({
        id: row.id,
        name: row.name,
        status: row.status,
        usersCount: row.users_count,
        revenue: row.revenue ? row.revenue.toFixed(2) : '0.00',
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error('Error fetching recent services:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent services',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Get available service types
router.get('/service-types', verifyToken, restrictTo('service_provider'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT id, name, description
      FROM public.service_types
      ORDER BY name
      `
    );

    res.json({
      success: true,
      types: rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
      })),
    });
  } catch (err) {
    console.error('Error fetching service types:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service types',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Update service provider company information
router.put('/company-info', verifyToken, restrictTo('service_provider'), async (req, res) => {
  try {
    console.log('Decoded user:', req.user);
    // Accept all possible fields from the frontend, with defaults
    const {
      companyName = '',
      website = '',
      businessLicense = '',
      serviceTypes = [],
      description = '',
      logoUrl = ''
    } = req.body;

    // Update the service_providers table, cast service_types to JSON
    const { rowCount } = await pool.query(
      `UPDATE public.service_providers
       SET company_name = $1,
           website = $2,
           business_license = $3,
           service_types = $4::json,
           description = $5,
           logo_url = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $7`,
      [companyName, website, businessLicense, JSON.stringify(serviceTypes), description, logoUrl, req.user.id]
    );
    console.log('Update rowCount:', rowCount);

    if (rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service provider not found',
        code: 'NOT_FOUND',
      });
    }

    res.json({ success: true, message: 'Company info updated successfully' });
  } catch (err) {
    console.error('Error updating company info:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update company info',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Get all services for the logged-in provider
router.get('/all-services', verifyToken, restrictTo('service_provider'), async (req, res) => {
  try {
    const { rows: providerRows } = await pool.query(
      'SELECT id FROM public.service_providers WHERE user_id = $1',
      [req.user.id]
    );
    if (!providerRows.length) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }
    const providerId = providerRows[0].id;
    const { rows } = await pool.query(
      'SELECT * FROM public.services WHERE provider_id = $1 ORDER BY created_at DESC',
      [providerId]
    );
    res.json({ success: true, services: rows });
  } catch (err) {
    console.error('Error fetching all services:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch services' });
  }
});

module.exports = router;