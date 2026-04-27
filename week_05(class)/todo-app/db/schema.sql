-- =========================================================
-- Todo App Schema
-- =========================================================

DROP TABLE IF EXISTS todo_tags CASCADE;
DROP TABLE IF EXISTS todos CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS todo_priority;

CREATE TYPE todo_priority AS ENUM ('low', 'normal', 'high');

CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE todos (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    description  TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    priority     todo_priority NOT NULL DEFAULT 'normal',
    due_date     DATE,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_todos_user_id        ON todos(user_id);
CREATE INDEX idx_todos_user_completed ON todos(user_id, is_completed);
CREATE INDEX idx_todos_due_date       ON todos(due_date) WHERE due_date IS NOT NULL;

CREATE TABLE tags (
    id      BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name    TEXT   NOT NULL,
    color   TEXT   NOT NULL DEFAULT '#888888',
    UNIQUE (user_id, name)
);

CREATE TABLE todo_tags (
    todo_id BIGINT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    tag_id  BIGINT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (todo_id, tag_id)
);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_todos_updated_at ON todos;
CREATE TRIGGER trg_todos_updated_at
BEFORE UPDATE ON todos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- Sample Data
-- =========================================================

-- 시드 비밀번호: 'password123' (bcrypt cost=10)
INSERT INTO users (email, name, password_hash) VALUES
  ('alice@example.com', '앨리스', '$2b$10$Ug5aVWYqg.igEEEkcW/MMu9Ma8AjWLrInoKGhqRGZGPG8m0pLyKS.'),
  ('bob@example.com',   '밥',     '$2b$10$Ug5aVWYqg.igEEEkcW/MMu9Ma8AjWLrInoKGhqRGZGPG8m0pLyKS.'),
  ('carol@example.com', '캐롤',   '$2b$10$Ug5aVWYqg.igEEEkcW/MMu9Ma8AjWLrInoKGhqRGZGPG8m0pLyKS.');

INSERT INTO tags (user_id, name, color) VALUES
  (1, '업무',  '#3b82f6'),
  (1, '개인',  '#10b981'),
  (1, '긴급',  '#ef4444'),
  (2, '공부',  '#8b5cf6'),
  (2, '운동',  '#f59e0b'),
  (3, '쇼핑',  '#ec4899');

INSERT INTO todos (user_id, title, description, is_completed, priority, due_date, completed_at) VALUES
  (1, '주간 회의 자료 준비',     '월요일 오전 10시 발표', FALSE, 'high',   CURRENT_DATE + INTERVAL '2 day', NULL),
  (1, '이메일 회신',            '미팅 일정 확정',        TRUE,  'normal', CURRENT_DATE,                    NOW() - INTERVAL '1 hour'),
  (1, '병원 예약',              '치과 정기 검진',        FALSE, 'normal', CURRENT_DATE + INTERVAL '7 day', NULL),
  (1, '장보기',                 '계란, 우유, 빵',        FALSE, 'low',    CURRENT_DATE,                    NULL),
  (2, 'PostgreSQL 인덱스 학습', '복합 인덱스 정리',      FALSE, 'high',   CURRENT_DATE + INTERVAL '3 day', NULL),
  (2, '러닝 5km',              '한강공원',              TRUE,  'normal', CURRENT_DATE - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  (2, '책 반납',                '도서관',                FALSE, 'low',    CURRENT_DATE + INTERVAL '5 day', NULL),
  (3, '생일 선물 구매',          '엄마 생신',             FALSE, 'high',   CURRENT_DATE + INTERVAL '4 day', NULL),
  (3, '세탁소 옷 찾기',          NULL,                   TRUE,  'low',    CURRENT_DATE - INTERVAL '2 day', NOW() - INTERVAL '2 day');

INSERT INTO todo_tags (todo_id, tag_id) VALUES
  (1, 1), (1, 3),
  (2, 1),
  (3, 2),
  (4, 2),
  (5, 4),
  (6, 5),
  (7, 4),
  (8, 6),
  (9, 6);
