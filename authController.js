const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const pool = require('./db');

const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumber;
};

const logSecurityEvent = async (type, message, severity) => {
  try {
    await pool.query(
      `
      INSERT INTO public.security_events (id, type, message, severity, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `,
      [uuidv4(), type, message, severity]
    );
  } catch (err) {
    console.error('Error logging security event:', err);
  }
};

// Configure nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_PORT == '465', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const signup = async (req, res) => {
  try {
    const { name, email, password, role, companyName } = req.body;

    // Validate password strength
    if (!validatePassword(password)) {
      await logSecurityEvent('signup_failed', `Invalid password format for email: ${email}`, 'medium');
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long and include uppercase, lowercase, and number',
        code: 'VALIDATION_ERROR',
      });
    }

    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    const userInsert = await pool.query(
      `INSERT INTO public.users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, email, hashedPassword, role]
    );
    const user = userInsert.rows[0];

    // If the user is a service provider, create a row in service_providers
    if (role === 'service_provider') {
      await pool.query(
        `INSERT INTO public.service_providers (user_id, company_name) VALUES ($1, $2)`,
        [user.id, companyName || '']
      );
    }

    await logSecurityEvent('signup_success', `User signed up: ${email}`, 'low');

    res.status(201).json({
      success: true,
      user: user,
    });
  } catch (error) {
    if (error.code === '23505') {
      await logSecurityEvent('signup_failed', `Email already exists: ${req.body.email}`, 'medium');
      return res.status(400).json({
        success: false,
        error: 'Email already exists',
        code: 'VALIDATION_ERROR',
      });
    }
    await logSecurityEvent('signup_error', `Signup error for email: ${req.body.email}: ${error.message}`, 'high');
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const { rows } = await pool.query(
      'SELECT * FROM public.users WHERE email = $1',
      [email]
    );

    if (!rows.length) {
      await logSecurityEvent('login_failed', `Invalid email: ${email}`, 'medium');
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'AUTHENTICATION_ERROR',
      });
    }

    const user = rows[0];

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      await logSecurityEvent('login_failed', `Invalid password for email: ${email}`, 'medium');
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'AUTHENTICATION_ERROR',
      });
    }

    if (user.role !== role) {
      await logSecurityEvent('login_failed', `Invalid role selection for email: ${email}, selected: ${role}, actual: ${user.role}`, 'medium');
      return res.status(403).json({
        success: false,
        error: 'Invalid role selection',
        code: 'AUTHORIZATION_ERROR',
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    await logSecurityEvent('login_success', `User logged in: ${email}`, 'low');

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    await logSecurityEvent('login_error', `Login error for email: ${req.body.email}: ${error.message}`, 'high');
    console.error('Login Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
};

const validateToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      await logSecurityEvent('token_validation_failed', 'No token provided', 'medium');
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        code: 'AUTHENTICATION_ERROR',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, name, email, role FROM public.users WHERE id = $1',
      [decoded.id]
    );

    if (!rows.length) {
      await logSecurityEvent('token_validation_failed', `User not found for id: ${decoded.id}`, 'medium');
      return res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'AUTHENTICATION_ERROR',
      });
    }

    res.json({
      success: true,
      valid: true,
      user: rows[0],
    });
  } catch (error) {
    await logSecurityEvent('token_validation_error', `Invalid token: ${error.message}`, 'medium');
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'AUTHENTICATION_ERROR',
    });
  }
};

const resetPasswordRequest = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    await logSecurityEvent('reset_password_failed', 'No email provided', 'medium');
    return res.status(400).json({
      success: false,
      error: 'Email is required',
      code: 'VALIDATION_ERROR',
    });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, email FROM public.users WHERE email = $1',
      [email]
    );

    if (!rows.length) {
      await logSecurityEvent('reset_password_failed', `Invalid email: ${email}`, 'medium');
      return res.status(404).json({
        success: false,
        error: 'Email not found',
        code: 'NOT_FOUND',
      });
    }

    const user = rows[0];
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + (parseInt(process.env.RESET_TOKEN_EXPIRES_IN) || 60 * 60 * 1000)); // 1 hour default

    await pool.query(
      `
      INSERT INTO public.password_reset_tokens (id, user_id, token, expires_at, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `,
      [uuidv4(), user.id, resetToken, expiresAt]
    );

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Click the link to reset your password: ${resetUrl}\nThis link expires in 1 hour.`,
      html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Click here</a> to reset your password.</p><p>This link expires in 1 hour.</p>`,
    };

    await transporter.sendMail(mailOptions);
    await logSecurityEvent('reset_password_request', `Password reset requested for email: ${email}`, 'low');

    res.json({
      success: true,
      message: 'Password reset email sent',
    });
  } catch (error) {
    await logSecurityEvent('reset_password_error', `Reset password error for email: ${email}: ${error.message}`, 'high');
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send reset email',
      code: 'INTERNAL_ERROR',
    });
  }
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    await logSecurityEvent('reset_password_failed', 'Missing token or new password', 'medium');
    return res.status(400).json({
      success: false,
      error: 'Token and new password are required',
      code: 'VALIDATION_ERROR',
    });
  }

  if (!validatePassword(newPassword)) {
    await logSecurityEvent('reset_password_failed', 'Invalid new password format', 'medium');
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 8 characters long and include uppercase, lowercase, and number',
      code: 'VALIDATION_ERROR',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `
      SELECT user_id, expires_at
      FROM public.password_reset_tokens
      WHERE token = $1
      `,
      [token]
    );

    if (!rows.length) {
      await client.query('ROLLBACK');
      await logSecurityEvent('reset_password_failed', `Invalid reset token: ${token}`, 'medium');
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'VALIDATION_ERROR',
      });
    }

    const { user_id, expires_at } = rows[0];

    if (new Date() > new Date(expires_at)) {
      await client.query('ROLLBACK');
      await logSecurityEvent('reset_password_failed', `Expired reset token: ${token}`, 'medium');
      return res.status(400).json({
        success: false,
        error: 'Token has expired',
        code: 'VALIDATION_ERROR',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    await client.query(
      `
      UPDATE public.users
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [hashedPassword, user_id]
    );

    await client.query(
      `
      DELETE FROM public.password_reset_tokens
      WHERE token = $1
      `,
      [token]
    );

    await client.query('COMMIT');
    await logSecurityEvent('reset_password_success', `Password reset for user_id: ${user_id}`, 'low');

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    await logSecurityEvent('reset_password_error', `Reset password error: ${error.message}`, 'high');
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
      code: 'INTERNAL_ERROR',
    });
  } finally {
    client.release();
  }
};

module.exports = {
  signup,
  login,
  validateToken,
  resetPasswordRequest,
  resetPassword,
};