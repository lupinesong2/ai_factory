require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

// ── App 초기화 ──────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// ── 미들웨어 ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── DB 연결 (환경변수 우선, 하드코딩 fallback) ──────────
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── DB Lazy Init (서버리스 cold start 대응) ─────────────
let dbInitialized = false;

async function initDB() {
  if (dbInitialized) return;
  // notes 테이블이 이미 Supabase에 생성되어 있으므로
  // 연결 확인만 수행
  await pool.query('SELECT 1');
  dbInitialized = true;
  console.log('DB 연결 성공');
}

// /api 경로 진입 전 DB 초기화 보장
app.use('/api', async (_req, res, next) => {
  try {
    await initDB();
    next();
  } catch (err) {
    console.error('DB 초기화 실패:', err.message);
    res.status(500).json({ success: false, message: 'Database connection failed' });
  }
});

// ── API 라우트 ──────────────────────────────────────────

// 전체 메모 조회
app.get('/api/notes', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM notes ORDER BY updated_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('조회 실패:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 메모 생성
app.post('/api/notes', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title && !content) {
      return res.status(400).json({ success: false, message: 'title 또는 content가 필요합니다' });
    }
    const { rows } = await pool.query(
      'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
      [title || '', content || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('생성 실패:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 메모 수정
app.put('/api/notes/:id', async (req, res) => {
  try {
    const { title, content } = req.body;
    const { rows } = await pool.query(
      'UPDATE notes SET title = $1, content = $2, updated_at = now() WHERE id = $3 RETURNING *',
      [title, content, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '메모를 찾을 수 없습니다' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('수정 실패:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 메모 삭제
app.delete('/api/notes/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM notes WHERE id = $1', [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: '메모를 찾을 수 없습니다' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('삭제 실패:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── SPA fallback (Express 5 문법) ───────────────────────
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── 서버 시작 / Vercel export ───────────────────────────
if (require.main === module) {
  app.listen(PORT, () => console.log(`서버 실행: http://localhost:${PORT}`));
}

module.exports = app;
