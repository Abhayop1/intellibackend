const pool = require('./db');

// Basic tree structure for services without tree data
const basicTree = {
  "root": {
    "id": "root",
    "label": "Service Configuration",
    "description": "Configure your service options",
    "children": ["basic", "premium"]
  },
  "basic": {
    "id": "basic",
    "label": "Basic Plan",
    "description": "Standard service plan",
    "children": [],
    "data": {
      "unitOfMeasurement": ["month"],
      "description": "Basic service plan"
    }
  },
  "premium": {
    "id": "premium",
    "label": "Premium Plan",
    "description": "Premium service plan with enhanced features",
    "children": [],
    "data": {
      "unitOfMeasurement": ["month"],
      "description": "Premium service plan"
    }
  }
};

// Broadband-specific tree
const broadbandTree = {
  "root": {
    "id": "root",
    "label": "Broadband Services",
    "description": "Choose your broadband service configuration",
    "children": ["wired", "wireless"]
  },
  "wired": {
    "id": "wired",
    "label": "Wired Connection",
    "description": "Fiber optic or cable connection",
    "children": ["fiber", "cable"],
    "data": {
      "unitOfMeasurement": ["Mbps", "GB", "month"],
      "description": "High-speed wired internet connection"
    }
  },
  "wireless": {
    "id": "wireless",
    "label": "Wireless Connection",
    "description": "WiFi or mobile broadband",
    "children": ["wifi", "mobile"],
    "data": {
      "unitOfMeasurement": ["Mbps", "GB", "month"],
      "description": "Wireless internet connection"
    }
  },
  "fiber": {
    "id": "fiber",
    "label": "Fiber Optic",
    "description": "High-speed fiber optic connection",
    "children": ["fiber_100", "fiber_500"],
    "data": {
      "unitOfMeasurement": ["Mbps", "month"],
      "description": "Ultra-fast fiber optic internet"
    }
  },
  "cable": {
    "id": "cable",
    "label": "Cable Internet",
    "description": "Coaxial cable connection",
    "children": ["cable_50", "cable_100"],
    "data": {
      "unitOfMeasurement": ["Mbps", "month"],
      "description": "Reliable cable internet connection"
    }
  },
  "wifi": {
    "id": "wifi",
    "label": "WiFi Hotspot",
    "description": "Wireless hotspot service",
    "children": ["wifi_basic", "wifi_premium"],
    "data": {
      "unitOfMeasurement": ["GB", "month"],
      "description": "Wireless hotspot internet access"
    }
  },
  "mobile": {
    "id": "mobile",
    "label": "Mobile Broadband",
    "description": "4G/5G mobile internet",
    "children": ["mobile_4g", "mobile_5g"],
    "data": {
      "unitOfMeasurement": ["GB", "month"],
      "description": "Mobile broadband internet"
    }
  },
  "fiber_100": {
    "id": "fiber_100",
    "label": "100 Mbps Fiber",
    "description": "100 Mbps fiber optic connection",
    "children": [],
    "data": {
      "unitOfMeasurement": ["Mbps", "month"],
      "description": "100 Mbps fiber optic internet"
    }
  },
  "fiber_500": {
    "id": "fiber_500",
    "label": "500 Mbps Fiber",
    "description": "500 Mbps fiber optic connection",
    "children": [],
    "data": {
      "unitOfMeasurement": ["Mbps", "month"],
      "description": "500 Mbps fiber optic internet"
    }
  },
  "cable_50": {
    "id": "cable_50",
    "label": "50 Mbps Cable",
    "description": "50 Mbps cable connection",
    "children": [],
    "data": {
      "unitOfMeasurement": ["Mbps", "month"],
      "description": "50 Mbps cable internet"
    }
  },
  "cable_100": {
    "id": "cable_100",
    "label": "100 Mbps Cable",
    "description": "100 Mbps cable connection",
    "children": [],
    "data": {
      "unitOfMeasurement": ["Mbps", "month"],
      "description": "100 Mbps cable internet"
    }
  },
  "wifi_basic": {
    "id": "wifi_basic",
    "label": "Basic WiFi",
    "description": "Basic WiFi hotspot service",
    "children": [],
    "data": {
      "unitOfMeasurement": ["GB", "month"],
      "description": "Basic WiFi hotspot service"
    }
  },
  "wifi_premium": {
    "id": "wifi_premium",
    "label": "Premium WiFi",
    "description": "Premium WiFi hotspot service",
    "children": [],
    "data": {
      "unitOfMeasurement": ["GB", "month"],
      "description": "Premium WiFi hotspot service"
    }
  },
  "mobile_4g": {
    "id": "mobile_4g",
    "label": "4G Mobile",
    "description": "4G mobile broadband",
    "children": [],
    "data": {
      "unitOfMeasurement": ["GB", "month"],
      "description": "4G mobile broadband internet"
    }
  },
  "mobile_5g": {
    "id": "mobile_5g",
    "label": "5G Mobile",
    "description": "5G mobile broadband",
    "children": [],
    "data": {
      "unitOfMeasurement": ["GB", "month"],
      "description": "5G mobile broadband internet"
    }
  }
};

async function addTreeDataToServices() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get all services that don't have tree data
    const servicesResult = await client.query(`
      SELECT id, name, service_type, tree
      FROM public.services
      WHERE tree IS NULL OR tree = ''
    `);

    console.log(`Found ${servicesResult.rows.length} services without tree data\n`);

    if (servicesResult.rows.length === 0) {
      console.log('All services already have tree data!');
      return;
    }

    for (const service of servicesResult.rows) {
      let treeData;
      
      // Choose tree based on service type
      if (service.service_type === 'broadband' || service.name.toLowerCase().includes('broadband')) {
        treeData = broadbandTree;
        console.log(`Adding broadband tree to: ${service.name}`);
      } else {
        treeData = basicTree;
        console.log(`Adding basic tree to: ${service.name}`);
      }

      // Update the service with tree data
      await client.query(
        'UPDATE public.services SET tree = $1 WHERE id = $2',
        [JSON.stringify(treeData), service.id]
      );
    }

    await client.query('COMMIT');
    
    console.log('\n✅ Successfully added tree data to all services!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding tree data:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  addTreeDataToServices()
    .then(() => {
      console.log('Tree data addition completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to add tree data:', err);
      process.exit(1);
    });
}

module.exports = { addTreeDataToServices }; 