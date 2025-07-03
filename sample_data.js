const pool = require('./db');
const { v4: uuidv4 } = require('uuid');

// Sample tree structure for broadband service
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
    "children": ["fiber_100", "fiber_500", "fiber_1000"],
    "data": {
      "unitOfMeasurement": ["Mbps", "month"],
      "description": "Ultra-fast fiber optic internet"
    }
  },
  "cable": {
    "id": "cable",
    "label": "Cable Internet",
    "description": "Coaxial cable connection",
    "children": ["cable_50", "cable_100", "cable_200"],
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
  "fiber_1000": {
    "id": "fiber_1000",
    "label": "1 Gbps Fiber",
    "description": "1 Gbps fiber optic connection",
    "children": [],
    "data": {
      "unitOfMeasurement": ["Mbps", "month"],
      "description": "1 Gbps fiber optic internet"
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
  "cable_200": {
    "id": "cable_200",
    "label": "200 Mbps Cable",
    "description": "200 Mbps cable connection",
    "children": [],
    "data": {
      "unitOfMeasurement": ["Mbps", "month"],
      "description": "200 Mbps cable internet"
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

async function createSampleServices() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // First, get a provider ID (we'll use the first one or create one)
    let providerResult = await client.query('SELECT id FROM public.service_providers LIMIT 1');
    
    if (!providerResult.rows.length) {
      // Create a sample provider if none exists
      const providerId = uuidv4();
      await client.query(
        'INSERT INTO public.service_providers (id, company_name, user_id, created_at) VALUES ($1, $2, $3, NOW())',
        [providerId, 'Sample Provider', 'sample-user-id']
      );
      providerResult = { rows: [{ id: providerId }] };
    }

    const providerId = providerResult.rows[0].id;

    // Create sample broadband service
    const broadbandServiceId = uuidv4();
    await client.query(
      `INSERT INTO public.services (id, provider_id, name, description, service_type, tree, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        broadbandServiceId,
        providerId,
        'Broadband Internet Service',
        'High-speed internet service with multiple connection options',
        'broadband',
        JSON.stringify(broadbandTree),
        'active'
      ]
    );

    // Create sample business service
    const businessServiceId = uuidv4();
    const businessTree = {
      "root": {
        "id": "root",
        "label": "Business Services",
        "description": "Choose your business service configuration",
        "children": ["internet", "support"]
      },
      "internet": {
        "id": "internet",
        "label": "Business Internet",
        "description": "Dedicated business internet connection",
        "children": ["dedicated", "shared"],
        "data": {
          "unitOfMeasurement": ["Mbps", "month"],
          "description": "Business-grade internet connection"
        }
      },
      "support": {
        "id": "support",
        "label": "Technical Support",
        "description": "Business technical support services",
        "children": ["basic_support", "premium_support"],
        "data": {
          "unitOfMeasurement": ["month", "incident"],
          "description": "Technical support for business customers"
        }
      },
      "dedicated": {
        "id": "dedicated",
        "label": "Dedicated Line",
        "description": "Dedicated internet line for business",
        "children": [],
        "data": {
          "unitOfMeasurement": ["Mbps", "month"],
          "description": "Dedicated internet line"
        }
      },
      "shared": {
        "id": "shared",
        "label": "Shared Line",
        "description": "Shared internet line for business",
        "children": [],
        "data": {
          "unitOfMeasurement": ["Mbps", "month"],
          "description": "Shared internet line"
        }
      },
      "basic_support": {
        "id": "basic_support",
        "label": "Basic Support",
        "description": "Basic technical support",
        "children": [],
        "data": {
          "unitOfMeasurement": ["month"],
          "description": "Basic technical support"
        }
      },
      "premium_support": {
        "id": "premium_support",
        "label": "Premium Support",
        "description": "Premium technical support with 24/7 availability",
        "children": [],
        "data": {
          "unitOfMeasurement": ["month"],
          "description": "Premium technical support"
        }
      }
    };

    await client.query(
      `INSERT INTO public.services (id, provider_id, name, description, service_type, tree, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        businessServiceId,
        providerId,
        'Business Internet & Support',
        'Complete business internet and support package',
        'business',
        JSON.stringify(businessTree),
        'active'
      ]
    );

    await client.query('COMMIT');
    
    console.log('Sample services created successfully!');
    console.log('Broadband Service ID:', broadbandServiceId);
    console.log('Business Service ID:', businessServiceId);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating sample services:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  createSampleServices()
    .then(() => {
      console.log('Sample data creation completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to create sample data:', err);
      process.exit(1);
    });
}

module.exports = { createSampleServices }; 