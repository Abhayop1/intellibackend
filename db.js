// // db.js
// const { Pool } = require('pg');

// const pool = new Pool({
//   user: 'postgres',       // the username you created in pgAdmin
//   host: 'localhost',          // or your remote host if not local
//   database: 'myapp',   // the database you created in pgAdmin
//   password: 'Abhay@123', // the password for your user
//   port: 5432,                 // default PostgreSQL port
// });

// module.exports = pool;
// db.js
const { Pool } = require('pg');
require('dotenv').config(); // This will load the variables from .env

// const pool = new Pool({
//   user: process.env.DB_USER,
//   host: process.env.DB_HOST,
//   database: process.env.DB_NAME,
//   password: process.env.DB_PASSWORD,
//   port: process.env.PORT || 5432,
// });
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});


module.exports = pool;

