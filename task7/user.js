const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('./userDb');

const PASSWORD_MIN_LENGTH = 1;
const PASSWORD_MAX_LENGTH = 72; // bcrypt only processes the first 72 UTF-8 bytes.

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function validateEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

async function ensureUsersTable() {
  const client = await pool.connect();
  try {
    await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    `);
  } finally {
    client.release();
  }
}

async function register(req, res) {
  const rawUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const username = rawUsername || email.split('@')[0] || 'user';

  if (!email || !validateEmail(email)) {
    return res.status(400).json({ error: 'valid email is required' });
  }

  if (!username || username.length > 100) {
    return res.status(400).json({ error: 'username must be between 1 and 100 characters' });
  }

  if (password.length < PASSWORD_MIN_LENGTH || Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_LENGTH) {
    return res.status(400).json({ error: `password is required and must be no more than ${PASSWORD_MAX_LENGTH} UTF-8 bytes` });
  }

  try {
    await ensureUsersTable();

    const passwordHash = await bcrypt.hash(password, 10);
    let result;
    try {
      result = await pool.query(
        'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
        [username, email, passwordHash]
      );
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'email already registered' });
      }
      throw error;
    }

    return res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Register error:', error.message);
    return res.status(500).json({ error: 'Could not register user' });
  }
}

async function login(req, res) {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !validateEmail(email)) {
    return res.status(400).json({ error: 'valid email is required' });
  }

  if (password.length < PASSWORD_MIN_LENGTH || Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_LENGTH) {
    return res.status(400).json({ error: `password is required and must be no more than ${PASSWORD_MAX_LENGTH} UTF-8 bytes` });
  }

  try {
    await ensureUsersTable();

    const result = await pool.query(
      'SELECT id, username, email, password FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    // Keep login failures indistinguishable to avoid disclosing registered emails.
    const storedHash = user?.password || '$2b$10$C6UzMDM.H6dfI/f/IKcEe.7Do6Qj0gM9n7eR2V0J9n2h0S9oX8Y0K';
    const isMatch = await bcrypt.compare(password, storedHash);

    if (!user || !isMatch) {
      return res.status(401).json({ error: 'invalid email or password' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
      console.error('JWT_SECRET must be configured with at least 32 bytes');
      return res.status(500).json({ error: 'Authentication is not configured' });
    }
    const payload = Buffer.from(JSON.stringify({ sub: String(user.id), iat: Date.now() })).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

    return res.status(200).json({
      message: 'Login successful',
      token: `${payload}.${signature}`,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ error: 'Could not login' });
  }
}

async function getProfile(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [req.user.sub]
    );
    if (result.rowCount === 0) return res.status(401).json({ error: 'Invalid token' });
    return res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Profile error:', error.message);
    return res.status(500).json({ error: 'Could not load profile' });
  }
}

module.exports = {
  ensureUsersTable,
  register,
  login,
  getProfile,
  createUser: register,
  loginUser: login,
};

