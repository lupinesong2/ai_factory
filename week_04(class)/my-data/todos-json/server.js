const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname);

// ========================================
// Middleware
// ========================================
app.use(express.json());
app.use(express.static(DATA_DIR));

// ========================================
// Helpers
// ========================================

/** DATA_DIR 내 모든 .json 파일을 읽어 배열로 반환 */
function readAllTodos() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'package.json' && f !== 'package-lock.json');
  return files.map(f => {
    const raw = fs.readFileSync(path.join(DATA_DIR, f), 'utf-8');
    return JSON.parse(raw);
  }).sort((a, b) => {
    // 파일명 앞 번호 기준 정렬
    const numA = parseInt(a.id.split('_')[0], 10) || 0;
    const numB = parseInt(b.id.split('_')[0], 10) || 0;
    return numA - numB;
  });
}

/** id로 해당 .json 파일 경로 반환 (없으면 null) */
function findTodoFile(id) {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'package.json' && f !== 'package-lock.json');
  const match = files.find(f => {
    const name = f.replace('.json', '');
    return name === id;
  });
  return match ? path.join(DATA_DIR, match) : null;
}

/** 다음 번호 계산 (기존 파일 중 가장 큰 번호 + 1) */
function getNextNumber() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'package.json' && f !== 'package-lock.json');
  let max = 0;
  for (const f of files) {
    const num = parseInt(f.split('_')[0], 10);
    if (!isNaN(num) && num > max) max = num;
  }
  return max + 1;
}

/** 번호를 두 자리 문자열로 (01, 02, ... 10, 11) */
function pad(n) {
  return String(n).padStart(2, '0');
}

// ========================================
// API Routes
// ========================================

// GET /api/todos — 모든 할일 조회
app.get('/api/todos', (_req, res) => {
  try {
    const todos = readAllTodos();
    res.json({ success: true, data: todos });
  } catch (err) {
    res.status(500).json({ success: false, message: '할일 목록을 불러올 수 없습니다.' });
  }
});

// POST /api/todos — 새 할일 추가
app.post('/api/todos', (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: '할일 텍스트가 필요합니다.' });
    }

    const num = getNextNumber();
    const sanitized = text.trim().replace(/[\/\\?%*:|"<>.\s]/g, '_').substring(0, 30);
    const id = `${pad(num)}_${sanitized}`;
    const today = new Date().toISOString().split('T')[0];

    const todo = {
      id,
      text: text.trim(),
      date: today,
      done: false,
      details: [],
    };

    const filePath = path.join(DATA_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(todo, null, 2), 'utf-8');

    res.status(201).json({ success: true, data: todo });
  } catch (err) {
    res.status(500).json({ success: false, message: '할일 추가에 실패했습니다.' });
  }
});

// PATCH /api/todos/:id — 완료 상태 토글
app.patch('/api/todos/:id', (req, res) => {
  try {
    const filePath = findTodoFile(req.params.id);
    if (!filePath) {
      return res.status(404).json({ success: false, message: '해당 할일을 찾을 수 없습니다.' });
    }

    const todo = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    todo.done = !todo.done;
    fs.writeFileSync(filePath, JSON.stringify(todo, null, 2), 'utf-8');

    res.json({ success: true, data: todo });
  } catch (err) {
    res.status(500).json({ success: false, message: '상태 변경에 실패했습니다.' });
  }
});

// DELETE /api/todos/:id — 할일 삭제
app.delete('/api/todos/:id', (req, res) => {
  try {
    const filePath = findTodoFile(req.params.id);
    if (!filePath) {
      return res.status(404).json({ success: false, message: '해당 할일을 찾을 수 없습니다.' });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, message: '삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, message: '삭제에 실패했습니다.' });
  }
});

// ========================================
// SPA Fallback
// ========================================
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ========================================
// Start / Export
// ========================================
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
module.exports = app;
