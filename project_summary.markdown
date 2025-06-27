# Project Summary: Backend Implementation

This document summarizes the backend implementation for the service management API, including file contents, endpoint functionalities, and a sample `.env` configuration.

## Project Structure and File Contents

### 1. `index.js`
- **Purpose**: Main entry point for the Express application.
- **Contents**:
  - Initializes the Express app.
  - Configures middleware: JSON parsing, CORS, rate limiting (login and API-wide), and global error handling.
  - Mounts route handlers for authentication, services, users, providers, and admins.
  - Starts the server on a specified port (default: 3000).
- **Key Features**:
  - CORS allows requests from specified origins (e.g., `http://localhost:5173`).
  - Rate limiting: 5 login attempts per 15 minutes, 100 API requests per minute.
  - Error handling for validation and authentication errors.

### 2. `db.js`
- **Purpose**: Database configuration and schema initialization.
- **Contents**:
  - Configures a PostgreSQL connection pool using `pg`.
  - Defines ENUM types: `user_role`, `service_status`, `config_status`, `upload_type`, `event_severity`.
  - Creates tables:
    - `users`: Stores user data (id, name, email, password_hash, role, phone, address, timestamps).
    - `service_providers`: Stores provider details (id, user_id, company_name, website, business_license, service_types, description, logo_url, timestamps).
    - `service_types`: Stores service types (id, name, description, created_at).
    - `services`: Stores service details (id, provider_id, name, description, service_type, configuration, status, users_count, revenue, timestamps).
    - `user_configurations`: Stores user service configurations (id, user_id, service_id, name, configuration, progress, status, timestamps).
    - `documents`: Stores uploaded documents (id, service_id, filename, file_path, file_type, file_size, upload_type, description, uploaded_by, created_at).
    - `security_events`: Stores security events (id, type, message, severity, created_at).
    - `password_reset_tokens`: Stores password reset tokens (id, user_id, token, expires_at, created_at).
  - Sets up a trigger to update `updated_at` timestamps.
  - Inserts default service types (Broadband, Cable TV, Mobile).
- **Dependencies**: `pg`, `uuid`, `dotenv`.

### 3. `auth.js`
- **Purpose**: Authentication middleware.
- **Contents**:
  - `verifyToken`: Verifies JWT tokens from the `Authorization` header, attaching `user` to the request if valid.
- **Dependencies**: `jsonwebtoken`.

### 4. `authMiddleware.js`
- **Purpose**: Role-based authorization middleware.
- **Contents**:
  - `restrictTo(roles)`: Restricts access to specified roles (e.g., `service_provider`, `admin`).
- **Dependencies**: None.

### 5. `upload.js`
- **Purpose**: File upload configuration.
- **Contents**:
  - Configures `multer` for file uploads to the `uploads/` directory.
  - Enforces a 10MB file size limit and stores files with a UUID-based name.
- **Dependencies**: `multer`, `uuid`.

### 6. `authController.js`
- **Purpose**: Handles authentication-related logic.
- **Contents**:
  - `signup`: Creates a new user with hashed password, validates password strength, logs security events.
  - `login`: Authenticates users, issues JWT, validates role, logs security events.
  - `validateToken`: Verifies JWT and returns user data.
  - `resetPasswordRequest`: Generates a reset token, stores it, sends a reset email, logs security events.
  - `resetPassword`: Validates reset token, updates password, deletes token, logs security events.
  - `logSecurityEvent`: Helper function to log events to `security_events`.
  - `validatePassword`: Ensures passwords meet complexity requirements.
- **Dependencies**: `bcrypt`, `jsonwebtoken`, `nodemailer`, `uuid`, `pg`.

### 7. `authRoutes.js`
- **Purpose**: Defines authentication routes.
- **Contents**:
  - Routes: `/signup`, `/login`, `/validate`, `/reset-password-request`, `/reset-password`.
- **Dependencies**: `express`, `authController.js`, `auth.js`.

### 8. `service_api.js`
- **Purpose**: Handles service management endpoints.
- **Contents**:
  - `GET /api/services`: Lists all active services with provider names.
  - `GET /api/services/:id`: Fetches details of a specific service.
  - `GET /api/services/:id/documents`: Lists documents for a service.
  - `POST /api/services`: Creates a new service (service providers only).
  - `POST /api/services/:id/upload-document`: Uploads a document for a service (authenticated users).
- **Dependencies**: `express`, `uuid`, `pg`, `auth.js`, `authMiddleware.js`, `upload.js`.

### 9. `user_api.js`
- **Purpose**: Handles user-specific endpoints.
- **Contents**:
  - `GET /api/user/recent-services`: Lists up to 10 recently accessed services for the user.
  - `GET /api/user/available-services`: Lists all active services.
  - `GET /api/user/catalogue`: Lists user’s saved configurations.
  - `GET /api/user/service-status`: Lists user’s active services.
  - `POST /api/user/update-profile`: Updates user’s name, phone, or address.
- **Dependencies**: `express`, `pg`, `auth.js`.

### 10. `provider_api.js`
- **Purpose**: Handles service provider-specific endpoints.
- **Contents**:
  - `GET /api/provider/company-info`: Fetches provider’s company details.
  - `GET /api/provider/stats`: Aggregates provider’s total services, users, and revenue.
  - `GET /api/provider/recent-services`: Lists up to 10 recently created services.
  - `GET /api/provider/service-types`: Lists all service types.
- **Dependencies**: `express`, `pg`, `auth.js`, `authMiddleware.js`.

### 11. `admin_api.js`
- **Purpose**: Handles admin-specific endpoints.
- **Contents**:
  - `GET /api/admin/users`: Lists all users with status and last login.
  - `GET /api/admin/services`: Lists all services with provider details.
  - `GET /api/admin/stats`: Aggregates system-wide stats (users, services, active configurations, revenue).
  - `GET /api/admin/security-events`: Lists up to 50 recent security events.
- **Dependencies**: `express`, `pg`, `auth.js`, `authMiddleware.js`.

### 12. `.env`
- **Purpose**: Environment variables for configuration.
- **Contents**: See sample below.

## Endpoint Functionalities

### Authentication Endpoints (`/api/auth`)
- **POST /signup**:
  - Creates a new user with name, email, password, and role.
  - Validates password strength (8+ characters, uppercase, lowercase, number).
  - Logs success (`signup_success`) or failure (`signup_failed`, `signup_error`) to `security_events`.
  - Returns user data on success.
- **POST /login**:
  - Authenticates user with email, password, and role.
  - Issues a JWT token.
  - Logs success (`login_success`) or failure (`login_failed`, `login_error`) to `security_events`.
  - Returns token and user data.
- **POST /validate**:
  - Verifies JWT token and returns user data.
  - Logs failure (`token_validation_failed`, `token_validation_error`) to `security_events`.
- **POST /reset-password-request**:
  - Initiates password reset by generating a token and sending an email with a reset link.
  - Stores token in `password_reset_tokens` with 1-hour expiration.
  - Logs success (`reset_password_request`) or failure (`reset_password_failed`, `reset_password_error`) to `security_events`.
- **POST /reset-password**:
  - Resets password using a valid token and new password.
  - Deletes used token.
  - Logs success (`reset_password_success`) or failure (`reset_password_failed`, `reset_password_error`) to `security_events`.

### User Endpoints (`/api/user`, authenticated)
- **GET /recent-services**:
  - Returns up to 10 recently accessed services from `user_configurations`, joined with `services` and `service_providers`.
- **GET /available-services**:
  - Lists all active services from `services`, joined with `service_providers`.
- **GET /catalogue**:
  - Lists user’s saved configurations from `user_configurations`, joined with `services`.
- **GET /service-status**:
  - Lists user’s active services from `user_configurations`, joined with `services`.
- **POST /update-profile**:
  - Updates user’s name, phone, or address in `users`.

### Service Provider Endpoints (`/api/provider`, service_provider only)
- **GET /company-info**:
  - Fetches provider’s details from `service_providers` based on user_id.
- **GET /stats**:
  - Aggregates total services, users, and revenue for the provider from `services`.
  - Includes placeholder `change` and `trend` values.
- **GET /recent-services**:
  - Lists up to 10 recently created services for the provider from `services`.
- **GET /service-types**:
  - Lists all service types from `service_types`.

### Admin Endpoints (`/api/admin`, admin only)
- **GET /users**:
  - Lists all users from `users` with last login (from `security_events`) and inferred status.
- **GET /services**:
  - Lists all services from `services`, joined with `service_providers`.
- **GET /stats**:
  - Aggregates total users, services, active configurations, and revenue.
  - Includes placeholder `change` and `trend` values.
- **GET /security-events**:
  - Lists up to 50 recent security events from `security_events`.

### Service Management Endpoints (`/api/services`)
- **GET /**:
  - Lists all active services from `services`, joined with `service_providers`.
  - Accessible to all authenticated users.
- **GET /:id**:
  - Fetches details of a specific service from `services`, joined with `service_providers`.
  - Accessible to all authenticated users.
- **GET /:id/documents**:
  - Lists documents for a service from `documents`.
  - Accessible to all authenticated users.
- **POST /**:
  - Creates a new service in `services` (service providers only).
  - Requires name and serviceType.
- **POST /:id/upload-document**:
  - Uploads a document to `documents` for a service (authenticated users).
  - Uses `multer` for file handling.

## Sample `.env` Configuration
```plaintext
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=serviceflow
DATABASE_USER=postgres
DATABASE_PASSWORD=your_postgres_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h

# File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# CORS Configuration
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# Email Configuration (for password reset)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password

# Password Reset Configuration
RESET_TOKEN_EXPIRES_IN=3600000
FRONTEND_URL=http://localhost:5173

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

**Notes for `.env`**:
- Replace `your_postgres_password` with your PostgreSQL password.
- Replace `your_super_secret_jwt_key_here` with a secure JWT secret (e.g., generated via `crypto.randomBytes(32).toString('hex')`).
- Replace `your_email@gmail.com` and `your_email_app_password` with valid email credentials (use an App Password for Gmail with 2FA).
- Update `FRONTEND_URL` to match your frontend application URL.
- Ensure `UPLOAD_PATH` directory (`./uploads`) exists and is writable.

## Additional Notes
- **Dependencies**: Install required packages:
  ```bash
  npm install express pg bcrypt jsonwebtoken uuid cors express-rate-limit multer nodemailer
  ```
- **Database Setup**: Ensure PostgreSQL is running and the database (`serviceflow`) is created. Run the app to initialize the schema.
- **Testing**: Populate all tables (`users`, `service_providers`, `services`, `service_types`, `user_configurations`, `documents`, `security_events`, `password_reset_tokens`) with test data.
- **Frontend Integration**: Update frontend to use correct API paths (e.g., `POST /api/services` instead of `POST /api/provider/services`) and handle password reset flows.
- **Security Events**: The `security_events` table is populated by signup, login, token validation, and password reset actions. Verify via `/api/admin/security-events`.
- **Stats Endpoints**: `/api/admin/stats` and `/api/provider/stats` use placeholder `change` and `trend` values. Add logic for historical data comparison if needed.
- **Route Structure**: `/api/services` handles service management; `/api/provider` handles provider-specific endpoints. Merge `service_api.js` and `provider_api.js` if desired.