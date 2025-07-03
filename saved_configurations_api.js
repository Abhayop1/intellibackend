const express = require('express');
const router = express.Router();
const pool = require('./db');
const { requireAuth } = require('./authMiddleware');

// Get all saved configurations for a user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('GET /api/saved-configurations called for user:', userId);
    const query = `
      SELECT 
        uc.id,
        uc.name,
        uc.configuration,
        uc.status,
        uc.created_at,
        uc.updated_at,
        s.name as service_name,
        s.description as service_description,
        sp.company_name as provider_name,
        uc.service_id
      FROM user_configurations uc
      LEFT JOIN services s ON uc.service_id = s.id
      LEFT JOIN service_providers sp ON s.provider_id = sp.id
      WHERE uc.user_id = $1
      ORDER BY uc.updated_at DESC
    `;
    const result = await pool.query(query, [userId]);
    console.log('Raw user_configurations rows:', result.rows);
    // Add detailed logging for each row
    result.rows.forEach((row, index) => {
      console.log(`Row ${index}: id=${row.id}, name="${row.name}", service_name="${row.service_name}"`);
    });
    const configurations = result.rows.map(row => {
      let configObj = {};
      try {
        configObj = typeof row.configuration === 'string' ? JSON.parse(row.configuration) : row.configuration;
      } catch (e) {
        configObj = {};
      }
      return {
        id: row.id,
        name: row.name,
        serviceId: row.service_id || 'unknown',
        userId: userId,
        serviceName: row.service_name || row.name,
        serviceDescription: row.service_description || `Configuration with ${configObj.selectedNodes?.length || 0} selected nodes`,
        provider: row.provider_name || 'ServiceFlow',
        userChoices: configObj.selectedNodes || [],
        selectedPath: configObj.selectedPath || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        status: row.status,
        totalEstimate: configObj.totalEstimate || 0
      };
    });
    console.log('Transformed configurations:', configurations);
    configurations.forEach((c, i) => console.log(`Config[${i}]: id=${c.id}, name=${c.name}, serviceName=${c.serviceName}`));
    res.json({
      success: true,
      configurations
    });
  } catch (error) {
    console.error('Error fetching saved configurations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch saved configurations'
    });
  }
});

// Save a new configuration
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { serviceId, name, selectedNodes, totalEstimate, selectedPath } = req.body;
    
    if (!name || !selectedNodes) {
      return res.status(400).json({
        success: false,
        error: 'Configuration name and selected nodes are required'
      });
    }
    
    const configuration = {
      selectedNodes,
      totalEstimate,
      selectedPath: selectedPath || [],
      timestamp: new Date().toISOString()
    };
    
    const query = `
      INSERT INTO user_configurations (id, user_id, service_id, name, configuration, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const id = require('uuid').v4();
    const result = await pool.query(query, [
      id,
      userId,
      serviceId,
      name,
      JSON.stringify(configuration),
      'saved'
    ]);
    
    res.status(201).json({
      success: true,
      configuration: {
        id: result.rows[0].id,
        serviceId: result.rows[0].service_id,
        userId: result.rows[0].user_id,
        serviceName: result.rows[0].name,
        serviceDescription: `Configuration with ${selectedNodes.length} selected nodes`,
        provider: 'ServiceFlow',
        userChoices: selectedNodes,
        selectedPath: selectedPath || [],
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
        status: result.rows[0].status,
        totalEstimate: totalEstimate
      }
    });
  } catch (error) {
    console.error('Error saving configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save configuration'
    });
  }
});

// Update a configuration
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const configId = req.params.id;
    const { name, selectedNodes, totalEstimate, selectedPath } = req.body;
    
    // First check if the configuration belongs to the user
    const checkQuery = 'SELECT * FROM user_configurations WHERE id = $1 AND user_id = $2';
    const checkResult = await pool.query(checkQuery, [configId, userId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }
    
    const configuration = {
      selectedNodes,
      totalEstimate,
      selectedPath: selectedPath || [],
      timestamp: new Date().toISOString()
    };
    
    const query = `
      UPDATE user_configurations 
      SET name = $1, configuration = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND user_id = $4
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      name,
      JSON.stringify(configuration),
      configId,
      userId
    ]);
    
    res.json({
      success: true,
      configuration: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration'
    });
  }
});

// Delete a configuration
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const configId = req.params.id;
    
    // First check if the configuration belongs to the user
    const checkQuery = 'SELECT * FROM user_configurations WHERE id = $1 AND user_id = $2';
    const checkResult = await pool.query(checkQuery, [configId, userId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }
    
    const query = 'DELETE FROM user_configurations WHERE id = $1 AND user_id = $2';
    await pool.query(query, [configId, userId]);
    
    res.json({
      success: true,
      message: 'Configuration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete configuration'
    });
  }
});

// Get a specific configuration by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const configId = req.params.id;
    
    const query = `
      SELECT 
        uc.*,
        s.name as service_name,
        s.description as service_description,
        sp.company_name as provider_name
      FROM user_configurations uc
      LEFT JOIN services s ON uc.service_id = s.id
      LEFT JOIN service_providers sp ON s.provider_id = sp.id
      WHERE uc.id = $1 AND uc.user_id = $2
    `;
    
    const result = await pool.query(query, [configId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }
    
    const row = result.rows[0];
    const configuration = {
      id: row.id,
      name: row.name,
      serviceId: row.service_id,
      userId: row.user_id,
      serviceName: row.name,
      serviceDescription: row.service_description || `Configuration with ${row.configuration?.selectedNodes?.length || 0} selected nodes`,
      provider: row.provider_name || 'ServiceFlow',
      userChoices: row.configuration?.selectedNodes?.map((node) => ({
        nodeId: node.node.id,
        selectedAttributes: {
          quantity: { quantity: node.quantity, unit: 'units', price: 0 }
        },
        customInputs: {}
      })) || [],
      selectedPath: row.configuration?.selectedPath || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
      totalEstimate: row.configuration?.totalEstimate || 0,
      configuration: row.configuration
    };
    
    res.json({
      success: true,
      configuration: configuration
    });
  } catch (error) {
    console.error('Error fetching configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configuration'
    });
  }
});

module.exports = router; 