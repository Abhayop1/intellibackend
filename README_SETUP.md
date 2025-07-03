# Database Setup Guide for New Users

## Quick Setup (No Sample Data)

### 1. Database Setup
The database schema is automatically created when you start the application. No manual setup required.

### 2. Required Tables
The following tables are automatically created:
- `users` - User accounts and authentication
- `service_providers` - Service provider companies
- `services` - Available services with configuration trees
- `user_configurations` - Saved user configurations
- `service_types` - Types of services (Broadband, Cable TV, Mobile)
- `documents` - Service-related documents
- `security_events` - Security logging
- `password_reset_tokens` - Password reset functionality

### 3. Getting Started
1. **Start the backend server:**
   ```bash
   cd backend
   npm start
   ```

2. **Start the frontend:**
   ```bash
   cd ../frontend
   npm run dev
   ```

3. **Register a new user account** through the frontend

4. **Create service providers and services** as needed through the admin interface

5. **Start configuring services!**

### 4. Database Schema Details

#### User Configurations Table
The `user_configurations` table stores saved configurations with:
- `id` - Unique identifier
- `user_id` - Reference to user
- `service_id` - Reference to service
- `name` - Configuration name (what you type when saving)
- `configuration` - JSON data with selected nodes and settings
- `status` - 'draft', 'saved', or 'active'
- `created_at` and `updated_at` timestamps

### 5. Environment Variables
Make sure you have these environment variables set in your `.env` file:
```
DATABASE_USER=postgres
DATABASE_HOST=localhost
DATABASE_NAME=myapp
DATABASE_PASSWORD=your_password
DATABASE_PORT=5432
```

### 6. No Sample Data
This setup creates a clean database with no sample data. You'll need to:
- Create service providers through the admin interface
- Add services with their configuration trees
- Users can then configure and save these services

That's it! Your application is ready to use with a clean, empty database. 