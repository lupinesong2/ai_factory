require('dotenv').config();
const express = require('express');
const { Pool, types } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

types.setTypeParser(1114, val => val); // timestamp without tz
types.setTypeParser(1184, val => val); // timestamp with tz

const app = express();
const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET;

const pool = new Pool({
  connectionString: (process.env.DATABASE_URL || '').trim(),
  ssl: { rejectUnauthorized: false },
});

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// JWT 인증 미들웨어
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: '토큰이 만료되었습니다' });
  }
}

// 선택적 인증 (로그인 안 해도 OK)
function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
  }
  next();
}

// ─── 인증 API ───

// 회원가입
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요' });

    const exists = await pool.query('SELECT id FROM community_users WHERE username = $1', [username]);
    if (exists.rows.length > 0) return res.status(409).json({ error: '이미 존재하는 아이디입니다' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO community_users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 로그인
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM community_users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: '아이디 또는 비밀번호가 틀렸습니다' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: '아이디 또는 비밀번호가 틀렸습니다' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 게시글 API ───

// 목록 (누구나)
app.get('/api/posts', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, author, author_id, created_at FROM community_posts ORDER BY created_at DESC'
    );
    res.json({ posts: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 상세 (누구나)
app.get('/api/posts/:id', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM community_posts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: '게시글을 찾을 수 없습니다' });

    const post = result.rows[0];
    post.isMine = req.user?.id === post.author_id;
    res.json({ post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 작성 (로그인 필요)
app.post('/api/posts', auth, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: '제목과 내용을 입력하세요' });

    const result = await pool.query(
      'INSERT INTO community_posts (title, content, author_id, author) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, content, req.user.id, req.user.username]
    );
    res.status(201).json({ post: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 수정 (본인만)
app.put('/api/posts/:id', auth, async (req, res) => {
  try {
    const { title, content } = req.body;
    const post = await pool.query('SELECT author_id FROM community_posts WHERE id = $1', [req.params.id]);
    if (post.rows.length === 0) return res.status(404).json({ error: '게시글을 찾을 수 없습니다' });
    if (post.rows[0].author_id !== req.user.id) return res.status(403).json({ error: '본인 글만 수정할 수 있습니다' });

    const result = await pool.query(
      'UPDATE community_posts SET title=$1, content=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
      [title, content, req.params.id]
    );
    res.json({ post: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 삭제 (본인만)
app.delete('/api/posts/:id', auth, async (req, res) => {
  try {
    const post = await pool.query('SELECT author_id FROM community_posts WHERE id = $1', [req.params.id]);
    if (post.rows.length === 0) return res.status(404).json({ error: '게시글을 찾을 수 없습니다' });
    if (post.rows[0].author_id !== req.user.id) return res.status(403).json({ error: '본인 글만 삭제할 수 있습니다' });

    await pool.query('DELETE FROM community_posts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Local: start server / Vercel: export app
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Community app running on http://localhost:${PORT}`);
  });
}
module.exports = app;
