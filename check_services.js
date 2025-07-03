const pool = require('./db');
const { v4: uuidv4 } = require('uuid');

// Comment out or remove the service check logic to avoid errors about missing columns
// async function checkExistingServices() {
//   try {
//     console.log('Checking existing services in database...\n');
//     
//     // Check services table
//     const servicesResult = await pool.query(`
//       SELECT 
//         s.id, s.name, s.description, s.service_type, s.status, s.tree,
//         sp.company_name AS provider_name
//       FROM public.services s
//       LEFT JOIN public.service_providers sp ON s.provider_id = sp.id
//       ORDER BY s.created_at DESC
//     `);
//     
//     console.log(`Found ${servicesResult.rows.length} services:\n`);
//     
//     if (servicesResult.rows.length === 0) {
//       console.log('No services found in database.');
//       console.log('You need to create some services first.');
//       return;
//     }
//     
//     servicesResult.rows.forEach((service, index) => {
//       console.log(`${index + 1}. Service: ${service.name}`);
//       console.log(`   ID: ${service.id}`);
//       console.log(`   Type: ${service.service_type}`);
//       console.log(`   Status: ${service.status}`);
//       console.log(`   Provider: ${service.provider_name || 'Unknown'}`);
//       console.log(`   Has Tree Data: ${service.tree ? 'Yes' : 'No'}`);
//       if (service.tree) {
//         try {
//           const treeData = JSON.parse(service.tree);
//           console.log(`   Tree Nodes: ${Object.keys(treeData).length}`);
//         } catch (e) {
//           console.log(`   Tree Data: Invalid JSON`);
//         }
//       }
//       console.log(`   Description: ${service.description || 'No description'}`);
//       console.log('');
//     });
//     
//     // Check service providers
//     const providersResult = await pool.query(`
//       SELECT id, company_name, user_id, created_at
//       FROM public.service_providers
//       ORDER BY created_at DESC
//     `);
//     
//     console.log(`Found ${providersResult.rows.length} service providers:\n`);
//     
//     providersResult.rows.forEach((provider, index) => {
//       console.log(`${index + 1}. Provider: ${provider.company_name}`);
//       console.log(`   ID: ${provider.id}`);
//       console.log(`   User ID: ${provider.user_id}`);
//       console.log(`   Created: ${provider.created_at}`);
//       console.log('');
//     });
//     
//   } catch (err) {
//     console.error('Error checking services:', err);
//   } finally {
//     await pool.end();
//   }
// }

// Script to auto-fix missing service_provider rows
async function fixMissingProviderRows() {
  try {
    // Find all service_provider users
    const { rows: users } = await pool.query(
      `SELECT id, name, email FROM public.users WHERE role = 'service_provider'`
    );
    // Find all user_ids already in service_providers
    const { rows: providers } = await pool.query(
      `SELECT user_id FROM public.service_providers`
    );
    const existingProviderUserIds = new Set(providers.map(p => p.user_id));
    // For each user, if missing, insert
    let inserted = 0;
    for (const user of users) {
      if (!existingProviderUserIds.has(user.id)) {
        await pool.query(
          `INSERT INTO public.service_providers (id, user_id, company_name) VALUES ($1, $2, $3)`,
          [uuidv4(), user.id, user.name + ' Company']
        );
        console.log(`Inserted provider row for user: ${user.email}`);
        inserted++;
      }
    }
    console.log(`Inserted ${inserted} missing provider rows.`);
  } catch (err) {
    console.error('Error fixing missing provider rows:', err);
  } finally {
    process.exit();
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  // Comment out or remove the service check logic to avoid errors about missing columns
  // checkExistingServices()
  //   .then(() => {
  //     console.log('Service check completed');
  //     process.exit(0);
  //   })
  //   .catch((err) => {
  //     console.error('Failed to check services:', err);
  //     process.exit(1);
  //   });
  fixMissingProviderRows();
}

module.exports = { checkExistingServices, fixMissingProviderRows }; 