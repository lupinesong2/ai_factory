-- ============================================
-- my-ecommerce DB Schema (Simple)
-- Prefix: ecom_
-- ============================================

-- 1. 사용자
CREATE TABLE ecom_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. 상품
CREATE TABLE ecom_products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  image_url VARCHAR(500),
  stock INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 주문
CREATE TABLE ecom_orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES ecom_users(id),
  total_price INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. 주문 상품
CREATE TABLE ecom_order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES ecom_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES ecom_products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price INTEGER NOT NULL
);

-- 5. 결제
CREATE TABLE ecom_payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES ecom_orders(id) ON DELETE CASCADE,
  method VARCHAR(30) NOT NULL,
  amount INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
