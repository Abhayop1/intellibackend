const express = require('express');
const router = express.Router();
const pool = require('./db');

// POST endpoint to save a service and its nodes
router.post('/save-service', async (req, res) => {
  const { name, description, nodes } = req.body;

  // Validate request body
  if (!name || !description || !Array.isArray(nodes)) {
    return res.status(400).json({ error: 'Missing required fields: name, description, or nodes' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert service into services table
    const serviceQuery = `
      INSERT INTO public.services (name, description, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      RETURNING id
    `;
    const serviceResult = await client.query(serviceQuery, [name, description]);
    const serviceId = serviceResult.rows[0].id;

    // Recursive function to insert nodes with parent relationships
    const insertNodes = async (nodes, parentId = null) => {
      for (const node of nodes) {
        const attributes = JSON.stringify(node.attributes || []);
        const nodeQuery = `
          INSERT INTO public.service_nodes (
            service_id, parent_id, name, description, attributes, 
            customizations, connection_type, condition, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
          RETURNING id
        `;
        const nodeValues = [
          serviceId,
          parentId,
          node.name,
          node.description,
          attributes,
          node.customizations || '',
          node.connectionType || 'sequential',
          node.condition || null,
        ];
        const nodeResult = await client.query(nodeQuery, nodeValues);
        const nodeId = nodeResult.rows[0].id;

        // Insert children recursively
        if (node.children && node.children.length > 0) {
          await insertNodes(node.children, nodeId);
        }
      }
    };

    // Insert all nodes
    await insertNodes(nodes);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Service and nodes saved successfully', serviceId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving service:', err);
    res.status(500).json({ error: 'Failed to save service' });
  } finally {
    client.release();
  }
});

module.exports = router;