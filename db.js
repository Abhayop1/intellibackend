const { Pool } = require('pg');
require('dotenv').config(); // Load .env variables

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'myapp',
  password: 'anush',
  port: 5432,
});

// Create services table
const createServicesTable = `
  CREATE TABLE IF NOT EXISTS public.services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Create service_nodes table
const createServiceNodesTable = `
  CREATE TABLE IF NOT EXISTS public.service_nodes (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES public.services(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES public.service_nodes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    attributes JSONB NOT NULL,
    customizations TEXT,
    connection_type VARCHAR(50) NOT NULL CHECK (connection_type IN ('sequential', 'conditional', 'parallel', 'optional')),
    condition VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Create users table
const createUsersTable = `
  CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'user', 'service_provider')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

Promise.all([
  pool.query(createServicesTable),
  pool.query(createServiceNodesTable),
  pool.query(createUsersTable),
])
  .then(() => console.log('Tables are ready'))
  .catch(err => console.error('Table creation error:', err));

module.exports = pool;