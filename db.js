const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config(); // Load .env variables

const pool = new Pool({
  user: process.env.DATABASE_USER || 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  database: process.env.DATABASE_NAME || 'serviceflow',
  password: process.env.DATABASE_PASSWORD || 'anush',
  port: process.env.DATABASE_PORT || 5432,
});

// Create ENUM types
const createEnums = `
  DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'service_provider', 'admin');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  DO $$ BEGIN
    CREATE TYPE service_status AS ENUM ('active', 'inactive', 'maintenance');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  DO $$ BEGIN
    CREATE TYPE config_status AS ENUM ('draft', 'saved', 'active');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  DO $$ BEGIN
    CREATE TYPE upload_type AS ENUM ('configuration', 'manual', 'other');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  DO $$ BEGIN
    CREATE TYPE event_severity AS ENUM ('low', 'medium', 'high');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
`;

// Create users table
const createUsersTable = `
  CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'user',
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Create service_providers table
const createServiceProvidersTable = `
  CREATE TABLE IF NOT EXISTS public.service_providers (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES public.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    business_license VARCHAR(255),
    service_types JSON,
    description TEXT,
    logo_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Create service_types table
const createServiceTypesTable = `
  CREATE TABLE IF NOT EXISTS public.service_types (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Create services table
const createServicesTable = `
  CREATE TABLE IF NOT EXISTS public.services (
    id VARCHAR(255) PRIMARY KEY,
    provider_id VARCHAR(255) REFERENCES public.service_providers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    service_type VARCHAR(100),
    configuration JSON,
    status service_status DEFAULT 'active',
    users_count INT DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Create user_configurations table
const createUserConfigurationsTable = `
  CREATE TABLE IF NOT EXISTS public.user_configurations (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES public.users(id) ON DELETE CASCADE,
    service_id VARCHAR(255) REFERENCES public.services(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    configuration JSON,
    progress INT DEFAULT 0,
    status config_status DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Create documents table
const createDocumentsTable = `
  CREATE TABLE IF NOT EXISTS public.documents (
    id VARCHAR(255) PRIMARY KEY,
    service_id VARCHAR(255) REFERENCES public.services(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100),
    file_size INT,
    upload_type upload_type,
    description TEXT,
    uploaded_by VARCHAR(255) REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Create security_events table
const createSecurityEventsTable = `
  CREATE TABLE IF NOT EXISTS public.security_events (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    severity event_severity NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Create password_reset_tokens table
const createPasswordResetTokensTable = `
  CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES public.users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Create trigger for updated_at
const createTrigger = `
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$ language 'plpgsql';

  CREATE OR REPLACE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

  CREATE OR REPLACE TRIGGER update_service_providers_updated_at
  BEFORE UPDATE ON public.service_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

  CREATE OR REPLACE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

  CREATE OR REPLACE TRIGGER update_user_configurations_updated_at
  BEFORE UPDATE ON public.user_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;

// Execute table creation
Promise.all([
  pool.query(createEnums),
  pool.query(createUsersTable),
  pool.query(createServiceProvidersTable),
  pool.query(createServiceTypesTable),
  pool.query(createServicesTable),
  pool.query(createUserConfigurationsTable),
  pool.query(createDocumentsTable),
  pool.query(createSecurityEventsTable),
  pool.query(createPasswordResetTokensTable),
  pool.query(createTrigger),
])
  .then(() => console.log('Database schema initialized successfully'))
  .catch(err => console.error('Table creation error:', err));

// Insert default service types (optional, for initialization)
const insertDefaultServiceTypes = async () => {
  try {
    const serviceTypes = [
      { id: uuidv4(), name: 'Broadband', description: 'High-speed internet services' },
      { id: uuidv4(), name: 'Cable TV', description: 'Television subscription services' },
      { id: uuidv4(), name: 'Mobile', description: 'Mobile network services' },
    ];

    for (const type of serviceTypes) {
      await pool.query(
        `
        INSERT INTO public.service_types (id, name, description, created_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING
        `,
        [type.id, type.name, type.description]
      );
    }
    console.log('Default service types inserted');
  } catch (err) {
    console.error('Error inserting default service types:', err);
  }
};

insertDefaultServiceTypes();

module.exports = pool;