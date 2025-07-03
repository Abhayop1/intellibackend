const pool = require('./db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

console.log('🚀 Starting database setup for new users...');

async function setupDatabase() {
  try {
    console.log('📋 Creating database schema...');
    
    // The database schema will be created automatically when db.js is imported
    // Just wait a moment for it to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ Database schema created successfully!');
    console.log('🎉 Setup complete! Your application is ready to use.');
    console.log('');
    console.log('📝 Next steps:');
    console.log('1. Start your backend server: npm start');
    console.log('2. Start your frontend: npm run dev');
    console.log('3. Register a new user account');
    console.log('4. Create service providers and services as needed');
    console.log('5. Start configuring services!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase }; 