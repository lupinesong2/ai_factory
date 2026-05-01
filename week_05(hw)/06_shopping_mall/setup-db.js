const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv/config');

async function setup() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Connected');

  // 스키마 생성
  await client.query(`
    DROP TABLE IF EXISTS shop_cart_items;
    DROP TABLE IF EXISTS shop_orders;
    DROP TABLE IF EXISTS shop_products;
    DROP TABLE IF EXISTS shop_users;

    -- 사용자
    CREATE TABLE shop_users (
      id         SERIAL PRIMARY KEY,
      username   VARCHAR(50) UNIQUE NOT NULL,
      password   VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 상품
    CREATE TABLE shop_products (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(100) NOT NULL,
      brand       VARCHAR(50) NOT NULL,
      price       INTEGER NOT NULL,
      image_url   TEXT NOT NULL,
      description TEXT DEFAULT '',
      stock       INTEGER DEFAULT 100,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    -- 장바구니
    CREATE TABLE shop_cart_items (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES shop_users(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES shop_products(id) ON DELETE CASCADE,
      quantity   INTEGER DEFAULT 1 CHECK (quantity > 0),
      added_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, product_id)
    );

    -- 주문
    CREATE TABLE shop_orders (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES shop_users(id),
      items      JSONB NOT NULL,
      total      INTEGER NOT NULL,
      status     VARCHAR(20) DEFAULT 'completed',
      ordered_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_cart_user ON shop_cart_items(user_id);
    CREATE INDEX idx_orders_user ON shop_orders(user_id);
    CREATE INDEX idx_products_brand ON shop_products(brand);
  `);
  console.log('Tables created');

  // 샘플 유저 (비밀번호: 1234)
  const hash = await bcrypt.hash('1234', 10);
  const users = ['김태민', '이서준', '박지우'];
  for (const u of users) {
    await client.query('INSERT INTO shop_users (username, password) VALUES ($1, $2)', [u, hash]);
  }
  console.log('Users created (password: 1234)');

  // 상품 데이터 (12개)
  const products = [
    ['클래식 러너', 'Nike', 159000, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop&crop=center', '가볍고 편안한 데일리 러닝화'],
    ['데일리 워커', 'New Balance', 129000, 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=400&h=400&fit=crop&crop=center', '클래식한 디자인의 워킹화'],
    ['스트릿 로우', 'Nike', 139000, 'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=400&h=400&fit=crop&crop=center', '스트릿 패션의 정석 로우탑'],
    ['울트라 부스트', 'Adidas', 219000, 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&h=400&fit=crop&crop=center', '최고의 쿠셔닝 퍼포먼스 러닝화'],
    ['캔버스 하이탑', 'Converse', 69000, 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=400&h=400&fit=crop&crop=center', '시대를 초월한 캔버스 스니커즈'],
    ['올드스쿨 스케이트', 'Vans', 79000, 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=400&h=400&fit=crop&crop=center', '스케이트보드 문화의 아이콘'],
    ['레트로 530', 'New Balance', 139000, 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=400&h=400&fit=crop&crop=center', '90년대 감성 레트로 러닝화'],
    ['에어 클래식', 'Nike', 129000, 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop&crop=center', '에어쿠션이 탑재된 클래식 스니커즈'],
    ['빈티지 스니커즈', 'Adidas', 119000, 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=400&fit=crop&crop=center', '빈티지 무드의 캐주얼 스니커즈'],
    ['스웨이드 클래식', 'Puma', 89000, 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=400&h=400&fit=crop&crop=center', '부드러운 스웨이드 소재의 클래식'],
    ['테크 러닝화', 'Asics', 169000, 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=400&h=400&fit=crop&crop=center', '첨단 기술이 적용된 프로 러닝화'],
    ['헤리티지 레더', 'Reebok', 99000, 'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?w=400&h=400&fit=crop&crop=center', '클래식 레더 소재의 헤리티지 모델'],
  ];

  for (const [name, brand, price, image, desc] of products) {
    await client.query(
      'INSERT INTO shop_products (name, brand, price, image_url, description) VALUES ($1, $2, $3, $4, $5)',
      [name, brand, price, image, desc]
    );
  }
  console.log(`${products.length}개 상품 삽입 완료`);

  // 샘플 장바구니 (김태민: 3개 상품)
  await client.query(`
    INSERT INTO shop_cart_items (user_id, product_id, quantity) VALUES
    (1, 1, 1),
    (1, 4, 2),
    (1, 7, 1)
  `);

  // 샘플 주문
  await client.query(`
    INSERT INTO shop_orders (user_id, items, total, status) VALUES
    (2, '[{"id":5,"name":"캔버스 하이탑","price":69000,"qty":1},{"id":6,"name":"올드스쿨 스케이트","price":79000,"qty":2}]', 227000, 'completed'),
    (3, '[{"id":11,"name":"테크 러닝화","price":169000,"qty":1}]', 169000, 'completed')
  `);
  console.log('샘플 장바구니 & 주문 삽입 완료');

  // 확인
  const result = await client.query('SELECT brand, COUNT(*) as cnt, SUM(price)::int as total FROM shop_products GROUP BY brand ORDER BY cnt DESC');
  console.log('\n브랜드별 상품:');
  console.table(result.rows);

  await client.end();
}

setup().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
