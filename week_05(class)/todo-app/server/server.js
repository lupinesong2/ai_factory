import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.resolve(__dirname, '..', 'client');
const PORT = Number(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

const app = express();
app.use(express.json());
app.use(express.static(CLIENT_DIR));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = Number(payload.sub);
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'INVALID_TOKEN' });
  }
}

// ========== Auth ==========

app.post('/api/auth/signup', async (req, res) => {
  const email = (req.body?.email ?? '').toString().trim().toLowerCase();
  const name = (req.body?.name ?? '').toString().trim();
  const password = (req.body?.password ?? '').toString();

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (name.length < 1 || name.length > 50) return res.status(400).json({ error: 'INVALID_NAME' });
  if (password.length < 8) return res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });

  try {
    const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rowCount > 0) return res.status(409).json({ error: 'EMAIL_TAKEN' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
       RETURNING id, email, name`,
      [email, name, hash]
    );
    const user = rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('POST /api/auth/signup', err);
    res.status(500).json({ error: 'SIGNUP_FAILED' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = (req.body?.email ?? '').toString().trim().toLowerCase();
  const password = (req.body?.password ?? '').toString();
  if (!email || !password) return res.status(400).json({ error: 'EMAIL_AND_PASSWORD_REQUIRED' });

  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('POST /api/auth/login', err);
    res.status(500).json({ error: 'LOGIN_FAILED' });
  }
});

app.get('/api/auth/me', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [req.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'USER_NOT_FOUND' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/auth/me', err);
    res.status(500).json({ error: 'DB_QUERY_FAILED' });
  }
});

// ========== Todos (인증 필요) ==========

app.get('/api/todos', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, is_completed, priority, due_date, created_at
       FROM todos
       WHERE user_id = $1
       ORDER BY is_completed ASC, created_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/todos', err);
    res.status(500).json({ error: 'DB_QUERY_FAILED' });
  }
});

app.post('/api/todos', authRequired, async (req, res) => {
  const title = (req.body?.title ?? '').toString().trim();
  if (!title) return res.status(400).json({ error: 'TITLE_REQUIRED' });
  if (title.length > 200) return res.status(400).json({ error: 'TITLE_TOO_LONG' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO todos (user_id, title) VALUES ($1, $2)
       RETURNING id, title, is_completed, priority, due_date, created_at`,
      [req.userId, title]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /api/todos', err);
    res.status(500).json({ error: 'DB_INSERT_FAILED' });
  }
});

app.patch('/api/todos/:id', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'INVALID_ID' });
  const { is_completed } = req.body ?? {};
  if (typeof is_completed !== 'boolean') return res.status(400).json({ error: 'IS_COMPLETED_REQUIRED' });
  try {
    const { rows } = await pool.query(
      `UPDATE todos
       SET is_completed = $1,
           completed_at = CASE WHEN $1 THEN NOW() ELSE NULL END
       WHERE id = $2 AND user_id = $3
       RETURNING id, title, is_completed, priority, due_date, created_at`,
      [is_completed, id, req.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/todos/:id', err);
    res.status(500).json({ error: 'DB_UPDATE_FAILED' });
  }
});

app.delete('/api/todos/:id', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'INVALID_ID' });
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM todos WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/todos/:id', err);
    res.status(500).json({ error: 'DB_DELETE_FAILED' });
  }
});

app.delete('/api/todos', authRequired, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM todos WHERE user_id = $1 AND is_completed = TRUE',
      [req.userId]
    );
    res.json({ deleted: rowCount });
  } catch (err) {
    console.error('DELETE /api/todos', err);
    res.status(500).json({ error: 'DB_DELETE_FAILED' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Todo server: http://localhost:${PORT}`);
});
