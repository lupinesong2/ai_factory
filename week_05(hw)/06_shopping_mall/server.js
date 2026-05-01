require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3004;
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

// ─── 인증 ───

app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '모든 항목을 입력하세요' });
    if (username.length < 2) return res.status(400).json({ error: '아이디는 2자 이상' });
    if (password.length < 4) return res.status(400).json({ error: '비밀번호는 4자 이상' });

    const exists = await pool.query('SELECT id FROM shop_users WHERE username = $1', [username]);
    if (exists.rows.length > 0) return res.status(409).json({ error: '이미 존재하는 아이디입니다' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO shop_users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM shop_users WHERE username = $1', [username]);
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

// ─── 상품 ───

app.get('/api/products', async (req, res) => {
  try {
    const { brand } = req.query;
    let query = 'SELECT * FROM shop_products ORDER BY id';
    let params = [];
    if (brand) {
      query = 'SELECT * FROM shop_products WHERE brand = $1 ORDER BY id';
      params = [brand];
    }
    const result = await pool.query(query, params);
    res.json({ products: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shop_products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: '상품을 찾을 수 없습니다' });
    res.json({ product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 장바구니 ───

app.get('/api/cart', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ci.id, ci.quantity, p.id as product_id, p.name, p.brand, p.price, p.image_url
      FROM shop_cart_items ci
      JOIN shop_products p ON ci.product_id = p.id
      WHERE ci.user_id = $1
      ORDER BY ci.added_at
    `, [req.user.id]);
    const items = result.rows;
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    res.json({ items, total, count: items.reduce((s, i) => s + i.quantity, 0) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cart', auth, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    await pool.query(`
      INSERT INTO shop_cart_items (user_id, product_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, product_id)
      DO UPDATE SET quantity = shop_cart_items.quantity + $3
    `, [req.user.id, productId, quantity]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/cart/:productId', auth, async (req, res) => {
  try {
    const { quantity } = req.body;
    if (quantity < 1) return res.status(400).json({ error: '수량은 1 이상이어야 합니다' });
    await pool.query(
      'UPDATE shop_cart_items SET quantity = $1 WHERE user_id = $2 AND product_id = $3',
      [quantity, req.user.id, req.params.productId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cart/:productId', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM shop_cart_items WHERE user_id = $1 AND product_id = $2',
      [req.user.id, req.params.productId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 주문 ───

app.post('/api/orders', auth, async (req, res) => {
  try {
    // 장바구니 조회
    const cartResult = await pool.query(`
      SELECT p.id, p.name, p.price, ci.quantity as qty
      FROM shop_cart_items ci
      JOIN shop_products p ON ci.product_id = p.id
      WHERE ci.user_id = $1
    `, [req.user.id]);

    if (cartResult.rows.length === 0) return res.status(400).json({ error: '장바구니가 비어있습니다' });

    const items = cartResult.rows;
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    // 주문 생성
    await pool.query(
      'INSERT INTO shop_orders (user_id, items, total) VALUES ($1, $2, $3)',
      [req.user.id, JSON.stringify(items), total]
    );

    // 장바구니 비우기
    await pool.query('DELETE FROM shop_cart_items WHERE user_id = $1', [req.user.id]);

    res.status(201).json({ success: true, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM shop_orders WHERE user_id = $1 ORDER BY ordered_at DESC',
      [req.user.id]
    );
    res.json({ orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 서버 시작 ───

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Shoe Store running on http://localhost:${PORT}`);
  });
}
module.exports = app;
