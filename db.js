const { Pool } = require('pg');
require('dotenv').config(); // Load .env variables

const pool = new Pool({
  user: process.env.DATABASE_USER || 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  database: process.env.DATABASE_NAME || 'myapp',
  password: process.env.DATABASE_PASSWORD || 'Abhay@123',
  port: process.env.DATABASE_PORT || 5432,
});

// Enable pgcrypto for UUID generation
const enablePgcrypto = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
`;

// Create ENUM types
const createEnums = `
  DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'service_provider', 'admin');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'user' NOT NULL,
    status user_status DEFAULT 'active' NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    company_name VARCHAR(255),
    website VARCHAR(255),
    business_license VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
`;

// Create service_providers table
const createServiceProvidersTable = `
  CREATE TABLE IF NOT EXISTS public.service_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    business_license VARCHAR(255),
    service_types JSON,
    description TEXT,
    logo_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
`;

// Create service_types table
const createServiceTypesTable = `
  CREATE TABLE IF NOT EXISTS public.service_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
`;

// Create services table
const createServicesTable = `
  CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    service_type UUID REFERENCES public.service_types(id) ON DELETE SET NULL,
    configuration JSON,
    status service_status DEFAULT 'active' NOT NULL,
    users_count INT DEFAULT 0 NOT NULL,
    revenue DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
    tree JSONB,
    documents JSONB,
    svg TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
`;

// Create user_configurations table
const createUserConfigurationsTable = `
  CREATE TABLE IF NOT EXISTS public.user_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    configuration JSON,
    progress INT DEFAULT 0 NOT NULL,
    status config_status DEFAULT 'draft' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
`;

// Create documents table
const createDocumentsTable = `
  CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100),
    file_size INT,
    upload_type upload_type,
    description TEXT,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
`;

// Create security_events table
const createSecurityEventsTable = `
  CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    severity event_severity NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
`;

// Create password_reset_tokens table
const createPasswordResetTokensTable = `
  CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
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

// Sequential table creation and initialization
async function initializeDatabase() {
  try {
    await pool.query(enablePgcrypto);
    await pool.query(createEnums);
    await pool.query(createUsersTable);
    await pool.query(createServiceProvidersTable);
    await pool.query(createServiceTypesTable);
    await pool.query(createServicesTable);
    await pool.query(createUserConfigurationsTable);
    await pool.query(createDocumentsTable);
    await pool.query(createSecurityEventsTable);
    await pool.query(createPasswordResetTokensTable);
    await pool.query(createTrigger);

    // Now insert default service types
    if (typeof insertDefaultServiceTypes === 'function') {
      await insertDefaultServiceTypes();
    }

    console.log('Database schema initialized successfully');
  } catch (err) {
    console.error('Table creation error:', err);
  }
}

initializeDatabase();

// Insert default service types (optional, for initialization)
const { v4: uuidv4 } = require('uuid');
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

module.exports = pool;