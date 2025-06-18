const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRoutes = require('./authRoutes');
const serviceRoutes = require('./service_api'); // New routes file

const app = express();
app.use(express.json());

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Root test route
app.get('/', (req, res) => {
  res.send('Welcome to the API!');
});

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);

// Example route (optional)
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.users');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

app.listen(3000, () => {
  console.log('App running on port 3000');
});