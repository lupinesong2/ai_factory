const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3003;

// --- DB 연결 ---
const pool = new Pool({
  connectionString: (process.env.DATABASE_URL || 'postgresql://postgres.pibwjwqwqgitygeicsco:8j30cDGjmKfd13wA@aws-1-us-east-1.pooler.supabase.com:6543/postgres').trim(),
  ssl: { rejectUnauthorized: false },
});

// --- Lazy Init ---
let dbInitialized = false;
async function initDB() {
  if (dbInitialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      date TEXT DEFAULT CURRENT_DATE,
      done BOOLEAN DEFAULT false,
      details JSONB DEFAULT '[]',
      content TEXT DEFAULT ''
    )
  `);
  dbInitialized = true;
}

// --- 미들웨어 ---
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// DB 초기화 미들웨어 (API 라우트 전에 실행)
app.use('/api', async (_req, res, next) => {
  try {
    await initDB();
    next();
  } catch (err) {
    console.error('DB init error:', err);
    res.status(500).json({ success: false, message: 'Database initialization failed' });
  }
});

// --- API 라우트 ---

// GET /api/todos — 전체 목록
app.get('/api/todos', async (_req, res) => {
  try {
    const result = await pool.query('SELECT id, text, date, done, details, content FROM todos ORDER BY id ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GET /api/todos error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch todos' });
  }
});

// POST /api/todos — 새 할일 추가
app.post('/api/todos', async (req, res) => {
  try {
    const { text, date, details, content } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'text is required' });
    }
    const result = await pool.query(
      `INSERT INTO todos (text, date, details, content)
       VALUES ($1, COALESCE($2, CURRENT_DATE::TEXT), COALESCE($3, '[]'::jsonb), COALESCE($4, ''))
       RETURNING id, text, date, done, details, content`,
      [text.trim(), date || null, details ? JSON.stringify(details) : null, content || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /api/todos error:', err);
    res.status(500).json({ success: false, message: 'Failed to create todo' });
  }
});

// PATCH /api/todos/:id — done 토글
app.patch('/api/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE todos SET done = NOT done WHERE id = $1
       RETURNING id, text, date, done, details, content`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PATCH /api/todos/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to update todo' });
  }
});

// DELETE /api/todos/:id — 삭제
app.delete('/api/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM todos WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    res.json({ success: true, message: 'Todo deleted' });
  } catch (err) {
    console.error('DELETE /api/todos/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete todo' });
  }
});

// --- 에러 핸들링 ---
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// --- 서버 시작 / Vercel export ---
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
module.exports = app;
