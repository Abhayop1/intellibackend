const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('./db');
const verifyToken = require('./auth');
const { restrictTo } = require('./authMiddleware');
const upload = require('./upload');

const router = express.Router();

// Get all available services
router.get('/', verifyToken, async (req, res) => {
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
    console.error('Error fetching services:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch services',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Get specific service details (for general users)
router.get('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT * FROM public.services WHERE id = $1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Service not found',
        code: 'NOT_FOUND',
      });
    }

    // Parse tree and documents if present
    let tree = rows[0].tree;
    let documents = rows[0].documents;
    try {
      if (typeof tree === 'string') tree = JSON.parse(tree);
    } catch {}
    try {
      if (typeof documents === 'string') documents = JSON.parse(documents);
    } catch {}
    res.json({
      success: true,
      service: {
        ...rows[0],
        tree,
        documents,
        svg: rows[0].svg || null,
      },
    });
  } catch (err) {
    console.error('Error fetching service:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Get documents for a service
router.get('/:id/documents', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows: serviceRows } = await pool.query(
      `
      SELECT id FROM public.services WHERE id = $1
      `,
      [id]
    );

    if (!serviceRows.length) {
      return res.status(404).json({
        success: false,
        error: 'Service not found',
        code: 'NOT_FOUND',
      });
    }

    const { rows } = await pool.query(
      `
      SELECT 
        id, filename, file_type, file_size, upload_type, description, created_at
      FROM public.documents
      WHERE service_id = $1
      ORDER BY created_at DESC
      `,
      [id]
    );

    res.json({
      success: true,
      documents: rows.map(row => ({
        id: row.id,
        filename: row.filename,
        fileType: row.file_type,
        fileSize: row.file_size,
        uploadType: row.upload_type,
        description: row.description,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Create new service (Service Provider only)
router.post('/', verifyToken, restrictTo('service_provider'), async (req, res) => {
  const { name, description, serviceType, configuration } = req.body;

  // Validate request body
  if (!name || !serviceType) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: name or serviceType',
      code: 'VALIDATION_ERROR',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get provider_id from service_providers table based on user_id
    const providerQuery = `
      SELECT id FROM public.service_providers WHERE user_id = $1
    `;
    const providerResult = await client.query(providerQuery, [req.user.id]);

    if (!providerResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        error: 'User is not a registered service provider',
        code: 'AUTHORIZATION_ERROR',
      });
    }

    const providerId = providerResult.rows[0].id;
    const serviceId = uuidv4();

    // Insert service into services table
    const serviceQuery = `
      INSERT INTO public.services (
        id, provider_id, name, description, service_type, configuration, status, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'active', CURRENT_TIMESTAMP)
      RETURNING id, name, status
    `;
    const serviceValues = [
      serviceId,
      providerId,
      name,
      description || '',
      serviceType,
      configuration ? JSON.stringify(configuration) : null,
    ];
    const serviceResult = await client.query(serviceQuery, serviceValues);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      service: serviceResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating service:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create service',
      code: 'INTERNAL_ERROR',
    });
  } finally {
    client.release();
  }
});

// Upload document for a service
router.post('/:id/upload-document', verifyToken, upload.single('document'), async (req, res) => {
  const { id } = req.params;
  const { type, description } = req.body;
  const file = req.file;

  // Validate request
  if (!file || !type) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: document or type',
      code: 'VALIDATION_ERROR',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify service exists
    const serviceQuery = `
      SELECT id FROM public.services WHERE id = $1
    `;
    const serviceResult = await client.query(serviceQuery, [id]);

    if (!serviceResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Service not found',
        code: 'NOT_FOUND',
      });
    }

    const documentId = uuidv4();
    const documentQuery = `
      INSERT INTO public.documents (
        id, service_id, filename, file_path, file_type, file_size, upload_type, description, uploaded_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING id, filename, file_type, file_size
    `;
    const documentValues = [
      documentId,
      id,
      file.originalname,
      file.path,
      file.mimetype,
      file.size,
      type,
      description || '',
      req.user.id,
    ];
    const documentResult = await client.query(documentQuery, documentValues);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      document: documentResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error uploading document:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to upload document',
      code: 'FILE_UPLOAD_ERROR',
    });
  } finally {
    client.release();
  }
});

// Save a new service with tree structure
router.post('/save-service', verifyToken, restrictTo('service_provider'), async (req, res) => {
  try {
    const { name, description, tree, documents, svg } = req.body;
    const providerIdResult = await pool.query(
      'SELECT id FROM public.service_providers WHERE user_id = $1',
      [req.user.id]
    );
    if (!providerIdResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }
    const providerId = providerIdResult.rows[0].id;

    // Save the service (tree as JSON)
    const result = await pool.query(
      `INSERT INTO public.services (provider_id, name, description, tree, documents, svg, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id`,
      [providerId, name, description, JSON.stringify(tree), JSON.stringify(documents), svg]
    );

    res.json({ success: true, serviceId: result.rows[0].id });
  } catch (err) {
    console.error('Error saving service:', err);
    res.status(500).json({ success: false, message: 'Failed to save service' });
  }
});

// Get a single service by ID for editing/viewing (for service providers)
router.get('/:id', verifyToken, restrictTo('service_provider'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM public.services WHERE id = $1',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }
    // Parse tree and documents if present
    let tree = rows[0].tree;
    let documents = rows[0].documents;
    try {
      if (typeof tree === 'string') tree = JSON.parse(tree);
    } catch {}
    try {
      if (typeof documents === 'string') documents = JSON.parse(documents);
    } catch {}
    res.json({
      success: true,
      service: {
        ...rows[0],
        tree,
        documents,
        svg: rows[0].svg || null,
      },
    });
  } catch (err) {
    console.error('Error fetching service:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch service' });
  }
});

// Update an existing service by ID
router.put('/:id', verifyToken, restrictTo('service_provider'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, tree, documents, svg } = req.body;

    // Update the service
    const result = await pool.query(
      `UPDATE public.services
       SET name = $1, description = $2, tree = $3, documents = $4, svg = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, description, JSON.stringify(tree), JSON.stringify(documents), svg, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }

    res.json({ success: true, service: result.rows[0] });
  } catch (err) {
    console.error('Error updating service:', err);
    res.status(500).json({ success: false, error: 'Failed to update service' });
  }
});

// Delete a service by ID
router.delete('/:id', verifyToken, restrictTo('service_provider'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM public.services WHERE id = $1 RETURNING *', [id]);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }
    res.json({ success: true, message: 'Service deleted' });
  } catch (err) {
    console.error('Error deleting service:', err);
    res.status(500).json({ success: false, error: 'Failed to delete service' });
  }
});

// Get service tree structure
router.get('/:id/tree', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT tree FROM public.services WHERE id = $1',
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Service not found',
        code: 'NOT_FOUND',
      });
    }

    let tree = rows[0].tree;
    try {
      if (typeof tree === 'string') tree = JSON.parse(tree);
    } catch (e) {
      tree = {};
    }

    res.json({
      success: true,
      tree: tree || {},
    });
  } catch (err) {
    console.error('Error fetching service tree:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service tree',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Get service glossary/metadata
router.get('/:id/glossary', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT name, description, service_type FROM public.services WHERE id = $1',
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Service not found',
        code: 'NOT_FOUND',
      });
    }

    // Create a basic glossary based on service information
    const service = rows[0];
    const glossary = {
      [service.name]: service.description || 'Service description',
      'service_type': service.service_type || 'general',
      'units': {
        'Mbps': 'Megabits per second - Internet speed measurement',
        'GB': 'Gigabytes - Data usage measurement',
        'month': 'Monthly billing period',
        'year': 'Yearly billing period',
        'installation': 'One-time installation service',
        'setup': 'Initial setup and configuration',
        'support': 'Technical support service',
        'maintenance': 'Ongoing maintenance service'
      }
    };

    res.json({
      success: true,
      glossary: glossary,
    });
  } catch (err) {
    console.error('Error fetching service glossary:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service glossary',
      code: 'INTERNAL_ERROR',
    });
  }
});



module.exports = router;