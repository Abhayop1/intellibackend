const express = require('express');
const pool = require('./db');
const verifyToken = require('./auth');

const router = express.Router();

// Get user's recently accessed services
router.get('/recent-services', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT 
        s.id, s.name, sp.company_name AS provider, 
        uc.updated_at AS last_accessed, uc.progress, uc.status
      FROM public.user_configurations uc
      JOIN public.services s ON uc.service_id = s.id
      JOIN public.service_providers sp ON s.provider_id = sp.id
      WHERE uc.user_id = $1
      ORDER BY uc.updated_at DESC
      LIMIT 10
      `,
      [req.user.user_id]
    );

    res.json({
      success: true,
      services: rows.map(row => ({
        id: row.id,
        name: row.name,
        provider: row.company_name,
        lastAccessed: row.last_accessed,
        progress: row.progress,
        status: row.status,
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

// Get all available services for users
router.get('/available-services', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT 
        s.id, s.name, sp.company_name AS provider, 
        s.description, s.service_type, s.status
      FROM public.services s
      JOIN public.service_providers sp ON s.provider_id = sp.id
      WHERE s.status = 'active'
      ORDER BY s.name
      `
    );

    res.json({
      success: true,
      services: rows.map(row => ({
        id: row.id,
        name: row.name,
        provider: row.company_name,
        description: row.description,
        serviceType: row.service_type,
        status: row.status,
      })),
    });
  } catch (err) {
    console.error('Error fetching available services:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available services',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Get user's saved configurations
router.get('/catalogue', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT 
        uc.id, uc.name, uc.service_id, s.name AS service_name,
        uc.progress, uc.status, uc.created_at
      FROM public.user_configurations uc
      JOIN public.services s ON uc.service_id = s.id
      WHERE uc.user_id = $1
      ORDER BY uc.created_at DESC
      `,
      [req.user.user_id]
    );

    res.json({
      success: true,
      items: rows.map(row => ({
        id: row.id,
        name: row.name,
        serviceId: row.service_id,
        serviceName: row.service_name,
        progress: row.progress,
        status: row.status,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error('Error fetching catalogue:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch catalogue',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Get user's active services status
router.get('/service-status', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT 
        s.id, s.name, s.status, s.updated_at AS last_updated
      FROM public.user_configurations uc
      JOIN public.services s ON uc.service_id = s.id
      WHERE uc.user_id = $1 AND uc.status = 'active'
      ORDER BY s.updated_at DESC
      `,
      [req.user.user_id]
    );

    res.json({
      success: true,
      services: rows.map(row => ({
        id: row.id,
        name: row.name,
        status: row.status,
        lastUpdated: row.last_updated,
      })),
    });
  } catch (err) {
    console.error('Error fetching service status:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service status',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Debug: Add a GET route to confirm registration
router.get('/update-profile', (req, res) => {
  res.json({ success: true, message: 'GET /api/user/update-profile is registered.' });
});

// Update user profile (all fields except image)
router.post('/update-profile', verifyToken, async (req, res) => {
  console.log('POST /api/user/update-profile called');
  const {
    name,
    email,
    phone,
    address,
    companyName,
    website,
    businessLicense,
    description
  } = req.body;

  // Build update query dynamically
  const updates = [];
  const values = [];
  let paramCount = 1;

  if (name) { updates.push(`name = $${paramCount++}`); values.push(name); }
  if (email) { updates.push(`email = $${paramCount++}`); values.push(email); }
  if (phone) { updates.push(`phone = $${paramCount++}`); values.push(phone); }
  if (address) { updates.push(`address = $${paramCount++}`); values.push(address); }
  if (companyName) { updates.push(`company_name = $${paramCount++}`); values.push(companyName); }
  if (website) { updates.push(`website = $${paramCount++}`); values.push(website); }
  if (businessLicense) { updates.push(`business_license = $${paramCount++}`); values.push(businessLicense); }
  if (description) { updates.push(`description = $${paramCount++}`); values.push(description); }

  if (updates.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one field is required',
      code: 'VALIDATION_ERROR',
    });
  }

  values.push(req.user.user_id);

  const query = `
    UPDATE public.users
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${paramCount}
    RETURNING name, email, phone, address, company_name, website, business_license, description
  `;

  try {
    const { rows } = await pool.query(query, values);
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'NOT_FOUND',
      });
    }
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: rows[0],
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      code: 'INTERNAL_ERROR',
    });
  }
});

// GET /profile - fetch current user's profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, address, company_name, website, business_license, description FROM public.users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'User not found', code: 'NOT_FOUND' });
    }
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch profile', code: 'INTERNAL_ERROR' });
  }
});

// POST /profile - update current user's profile (no profile picture)
router.post('/profile', verifyToken, async (req, res) => {
  const {
    name,
    email,
    phone,
    address,
    companyName,
    website,
    businessLicense,
    description
  } = req.body;

  // Build update query dynamically
  const updates = [];
  const values = [];
  let paramCount = 1;

  if (name) { updates.push(`name = $${paramCount++}`); values.push(name); }
  if (email) { updates.push(`email = $${paramCount++}`); values.push(email); }
  if (phone) { updates.push(`phone = $${paramCount++}`); values.push(phone); }
  if (address) { updates.push(`address = $${paramCount++}`); values.push(address); }
  if (companyName) { updates.push(`company_name = $${paramCount++}`); values.push(companyName); }
  if (website) { updates.push(`website = $${paramCount++}`); values.push(website); }
  if (businessLicense) { updates.push(`business_license = $${paramCount++}`); values.push(businessLicense); }
  if (description) { updates.push(`description = $${paramCount++}`); values.push(description); }

  if (updates.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one field is required',
      code: 'VALIDATION_ERROR',
    });
  }

  values.push(req.user.id);

  const query = `
    UPDATE public.users
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${paramCount}
    RETURNING id, name, email, phone, address, company_name, website, business_license, description
  `;

  try {
    const { rows } = await pool.query(query, values);
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'NOT_FOUND',
      });
    }
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: rows[0],
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      code: 'INTERNAL_ERROR',
    });
  }
});

module.exports = router;