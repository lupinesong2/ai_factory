const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ImageKit = require('imagekit');
const multer = require('multer');

// ─── App Init ───────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = 'heukdam-jwt-secret-2026';
const JWT_EXPIRES_IN = '7d';

// ImageKit CDN
const imagekit = new ImageKit({
  publicKey: 'public_6N5Ws1uA9O145IHdLPwGWC240lc=',
  privateKey: 'private_iX0XdEMy8hv1d2cWnL+5/osLn4g=',
  urlEndpoint: 'https://ik.imagekit.io/taemin',  // Update with your ImageKit ID
});

// Multer for file uploads (5MB limit, memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// TossPayments
const TOSS_SECRET_KEY = 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6';
const TOSS_AUTH = 'Basic ' + Buffer.from(TOSS_SECRET_KEY + ':').toString('base64');

// ─── Database ───────────────────────────────────────────────
const pool = new Pool({
  connectionString: (process.env.DATABASE_URL || 'postgresql://postgres.pibwjwqwqgitygeicsco:8j30cDGjmKfd13wA@aws-1-us-east-1.pooler.supabase.com:6543/postgres').trim(),
  ssl: { rejectUnauthorized: false },
});

let dbInitialized = false;
async function initDB() {
  if (dbInitialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      items JSONB NOT NULL,
      subtotal INTEGER NOT NULL,
      shipping INTEGER NOT NULL,
      total INTEGER NOT NULL,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      address TEXT NOT NULL,
      address_detail VARCHAR(255) DEFAULT '',
      payment_method VARCHAR(20) DEFAULT 'card',
      payment_key VARCHAR(200),
      order_uid VARCHAR(100) UNIQUE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Add columns if missing (for existing tables)
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_key VARCHAR(200)`).catch(() => {});
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_uid VARCHAR(100) UNIQUE`).catch(() => {});

  // Seed sample users (password: test1234)
  const { rows } = await pool.query('SELECT COUNT(*) AS cnt FROM users');
  if (Number(rows[0].cnt) === 0) {
    const hash = await bcrypt.hash('test1234', 10);
    await pool.query(
      `INSERT INTO users (email, password, name) VALUES
        ('hong@example.com',  $1, '홍길동'),
        ('kim@example.com',   $1, '김민지'),
        ('lee@example.com',   $1, '이도현')
       ON CONFLICT (email) DO NOTHING`,
      [hash]
    );
    console.log('Sample users seeded');
  }

  dbInitialized = true;
}

// ─── Middleware ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for development
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (_req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Static files
app.use(express.static(path.join(__dirname)));

// DB lazy init for /api routes
app.use('/api', async (_req, res, next) => {
  try {
    await initDB();
    next();
  } catch (err) {
    console.error('DB init error:', err.message);
    res.status(500).json({ success: false, message: 'Database initialization failed' });
  }
});

// ─── Auth Helpers ───────────────────────────────────────────
function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '인증 토큰이 필요합니다.' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: '유효하지 않거나 만료된 토큰입니다.' });
  }
}

// ─── API Routes ─────────────────────────────────────────────

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: '이메일, 비밀번호, 이름은 필수입니다.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: '올바른 이메일 형식이 아닙니다.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: '비밀번호는 최소 6자 이상이어야 합니다.' });
    }

    // Check duplicate email
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: '이미 사용 중인 이메일입니다.' });
    }

    // Hash password and insert
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: { token, user: { id: user.id, email: user.email, name: user.name } },
    });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ success: false, message: '회원가입 처리 중 오류가 발생했습니다.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: '이메일과 비밀번호를 입력해주세요.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      data: { token, user: { id: user.id, email: user.email, name: user.name } },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    console.error('Me error:', err.message);
    res.status(500).json({ success: false, message: '사용자 정보 조회 중 오류가 발생했습니다.' });
  }
});

// ─── Order Routes ───────────────────────────────────────────

// POST /api/orders — 주문 생성
app.post('/api/orders', verifyToken, async (req, res) => {
  try {
    const { items, subtotal, shipping, total, name, phone, address, addressDetail, paymentMethod } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: '주문 상품이 없습니다.' });
    }
    if (!name || !phone || !address) {
      return res.status(400).json({ success: false, message: '배송 정보를 모두 입력해주세요.' });
    }

    const orderUid = `heukdam-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await pool.query(
      `INSERT INTO orders (user_id, items, subtotal, shipping, total, name, phone, address, address_detail, payment_method, order_uid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, order_uid, total, status, created_at`,
      [req.user.id, JSON.stringify(items), subtotal, shipping, total, name, phone, address, addressDetail || '', paymentMethod || 'card', orderUid]
    );

    res.status(201).json({ success: true, data: { order: result.rows[0] } });
  } catch (err) {
    console.error('Order error:', err.message);
    res.status(500).json({ success: false, message: '주문 처리 중 오류가 발생했습니다.' });
  }
});

// GET /api/orders — 내 주문 목록
app.get('/api/orders', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Orders list error:', err.message);
    res.status(500).json({ success: false, message: '주문 조회 중 오류가 발생했습니다.' });
  }
});

// ─── Payment Routes ────────────────────────────────────────

// POST /api/payments/confirm — 토스페이먼츠 결제 승인
app.post('/api/payments/confirm', async (req, res) => {
  try {
    const { paymentKey, orderId, amount } = req.body;

    if (!paymentKey || !orderId || !amount) {
      return res.status(400).json({ success: false, message: '결제 정보가 올바르지 않습니다.' });
    }

    // 서버에 저장된 주문 금액과 비교 (위변조 방지)
    const orderResult = await pool.query('SELECT * FROM orders WHERE order_uid = $1', [orderId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '주문을 찾을 수 없습니다.' });
    }

    const order = orderResult.rows[0];
    if (order.total !== Number(amount)) {
      return res.status(400).json({ success: false, message: '결제 금액이 일치하지 않습니다.' });
    }

    // 토스페이먼츠 승인 API 호출
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': TOSS_AUTH,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    });

    const tossData = await tossRes.json();

    if (!tossRes.ok) {
      return res.status(tossRes.status).json({
        success: false,
        message: tossData.message || '결제 승인에 실패했습니다.',
        code: tossData.code,
      });
    }

    // 결제 성공 → 주문 상태 업데이트
    await pool.query(
      'UPDATE orders SET status = $1, payment_key = $2, payment_method = $3 WHERE order_uid = $4',
      ['paid', paymentKey, tossData.method || 'card', orderId]
    );

    res.json({ success: true, data: { orderId: order.id, orderUid: orderId } });
  } catch (err) {
    console.error('Payment confirm error:', err.message);
    res.status(500).json({ success: false, message: '결제 승인 처리 중 오류가 발생했습니다.' });
  }
});

// ─── ImageKit Routes ───────────────────────────────────────
// GET /api/imagekit/auth — client-side upload auth parameters
app.get('/api/imagekit/auth', (_req, res) => {
  try {
    const result = imagekit.getAuthenticationParameters();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('ImageKit auth error:', err.message);
    res.status(500).json({ success: false, message: '인증 파라미터 생성에 실패했습니다.' });
  }
});

// POST /api/imagekit/upload — server-side image upload
app.post('/api/imagekit/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '이미지 파일이 필요합니다.' });
    }
    const result = await imagekit.upload({
      file: req.file.buffer.toString('base64'),
      fileName: req.file.originalname,
      folder: '/heukdam-products',
    });
    res.json({
      success: true,
      data: { url: result.url, fileId: result.fileId, thumbnailUrl: result.thumbnailUrl },
    });
  } catch (err) {
    console.error('ImageKit upload error:', err.message);
    res.status(500).json({ success: false, message: '이미지 업로드에 실패했습니다.' });
  }
});

// GET /api/imagekit/images — list uploaded images
app.get('/api/imagekit/images', async (_req, res) => {
  try {
    const files = await imagekit.listFiles({ path: '/heukdam-products', sort: 'DESC_CREATED' });
    res.json({ success: true, data: files });
  } catch (err) {
    console.error('ImageKit list error:', err.message);
    res.status(500).json({ success: false, message: '이미지 목록 조회에 실패했습니다.' });
  }
});

// ─── SPA Fallback ───────────────────────────────────────────
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Error Handling ─────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, message: '서버 내부 오류가 발생했습니다.' });
});

// ─── Start / Export ─────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
module.exports = app;
