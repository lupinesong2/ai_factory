require('dotenv').config();
const express = require('express');
const { Pool, types } = require('pg');
const path = require('path');

// DATE 타입을 문자열 그대로 반환 (타임존 변환 방지)
types.setTypeParser(1082, val => val);

const app = express();
const PORT = process.env.PORT || 3001;

// PostgreSQL 연결
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 미들웨어
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// GET /api/entries — 전체 조회 (필터 지원)
app.get('/api/entries', async (req, res) => {
  try {
    const { category } = req.query;
    let query, params;

    if (category && category !== 'all') {
      query = 'SELECT * FROM budget_entries WHERE category = $1 ORDER BY date DESC';
      params = [category];
    } else {
      query = 'SELECT * FROM budget_entries ORDER BY date DESC';
      params = [];
    }

    const result = await pool.query(query, params);
    const entries = result.rows;
    const total = entries.reduce((sum, e) => sum + Number(e.amount), 0);

    res.json({ entries, total, count: entries.length });
  } catch (err) {
    console.error('GET /api/entries error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/summary — 카테고리별 요약
app.get('/api/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT category, COUNT(*)::int AS count, SUM(amount)::int AS total
      FROM budget_entries
      GROUP BY category
      ORDER BY total DESC
    `);
    const grandTotal = result.rows.reduce((sum, r) => sum + r.total, 0);
    res.json({ categories: result.rows, grandTotal });
  } catch (err) {
    console.error('GET /api/summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/entries — 새 항목 추가
app.post('/api/entries', async (req, res) => {
  try {
    const { date, category, name, amount, memo } = req.body;
    const result = await pool.query(
      'INSERT INTO budget_entries (date, category, name, amount, memo) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [date, category, name, amount, memo || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/entries error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/entries/:id — 항목 수정
app.put('/api/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, category, name, amount, memo } = req.body;
    const result = await pool.query(
      'UPDATE budget_entries SET date=$1, category=$2, name=$3, amount=$4, memo=$5 WHERE id=$6 RETURNING *',
      [date, category, name, amount, memo || '', id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/entries/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/entries/:id — 항목 삭제
app.delete('/api/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM budget_entries WHERE id=$1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/entries/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
