const express = require('express');
const verifyToken = require('./auth');

const router = express.Router();

// Get UoM costs (global endpoint)
router.get('/uom-costs', verifyToken, async (req, res) => {
  try {
    // Return a standard set of UoM costs
    const uomCosts = {
      'Mbps': 10.0, // ₹10 per Mbps
      'GB': 5.0,    // ₹5 per GB
      'month': 500.0, // ₹500 per month
      'year': 5000.0, // ₹5000 per year
      'installation': 1000.0, // ₹1000 for installation
      'setup': 500.0, // ₹500 for setup
      'support': 200.0, // ₹200 for support
      'maintenance': 300.0 // ₹300 for maintenance
    };

    res.json({
      success: true,
      uomCosts: uomCosts,
    });
  } catch (err) {
    console.error('Error fetching UoM costs:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch UoM costs',
      code: 'INTERNAL_ERROR',
    });
  }
});

module.exports = router; 