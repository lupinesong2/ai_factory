const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- Helper: .txt 파일 파싱 ---
function parseTodoFile(filename, content) {
  const id = filename.replace('.txt', '');
  let text = '';
  let done = false;
  let date = '';
  const details = [];

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('할일:')) {
      text = trimmed.replace('할일:', '').trim();
    } else if (trimmed.startsWith('상태:')) {
      const status = trimmed.replace('상태:', '').trim();
      done = status === '완료';
    } else if (trimmed.startsWith('날짜:')) {
      date = trimmed.replace('날짜:', '').trim();
    } else if (trimmed.startsWith('- ')) {
      details.push(trimmed);
    }
  }

  return { id, text, done, date, details, filename };
}

// --- Helper: todo 객체를 .txt 내용으로 변환 ---
function buildTodoContent(text, date, done, details) {
  let content = `할일: ${text}\n`;
  content += `날짜: ${date}\n`;
  content += `상태: ${done ? '완료' : '미완료'}\n`;
  if (details && details.length > 0) {
    content += '\n';
    content += details.join('\n') + '\n';
  }
  return content;
}

// --- Helper: todos 디렉토리에서 .txt 파일 목록 가져오기 ---
function getTxtFiles() {
  const files = fs.readdirSync(__dirname);
  return files
    .filter(f => f.endsWith('.txt'))
    .sort();
}

// --- Helper: 다음 번호 계산 ---
function getNextNumber() {
  const files = getTxtFiles();
  let maxNum = 0;
  for (const f of files) {
    const match = f.match(/^(\d+)_/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return String(maxNum + 1).padStart(2, '0');
}

// --- API Routes ---

// GET /api/todos — 모든 할일 목록 반환
app.get('/api/todos', (_req, res) => {
  try {
    const files = getTxtFiles();
    const todos = files.map(f => {
      const content = fs.readFileSync(path.join(__dirname, f), 'utf-8');
      return parseTodoFile(f, content);
    });
    res.json({ success: true, data: todos });
  } catch (err) {
    res.status(500).json({ success: false, message: '할일 목록을 불러오는 데 실패했습니다.' });
  }
});

// POST /api/todos — 새 할일 생성
app.post('/api/todos', (req, res) => {
  try {
    const { text, date, details } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: '할일 내용(text)은 필수입니다.' });
    }

    const todoDate = date || new Date().toISOString().slice(0, 10);
    const todoDetails = details || [];
    const nextNum = getNextNumber();

    // 파일명에 사용할 제목: 공백 제거하고 간결하게
    const safeName = text.replace(/\s+/g, '').slice(0, 10);
    const filename = `${nextNum}_${safeName}.txt`;
    const content = buildTodoContent(text, todoDate, false, todoDetails);

    fs.writeFileSync(path.join(__dirname, filename), content, 'utf-8');

    const todo = parseTodoFile(filename, content);
    res.status(201).json({ success: true, data: todo });
  } catch (err) {
    res.status(500).json({ success: false, message: '할일 생성에 실패했습니다.' });
  }
});

// PATCH /api/todos/:id — 상태 토글 (미완료 <-> 완료)
app.patch('/api/todos/:id', (req, res) => {
  try {
    const { id } = req.params;
    const filename = `${id}.txt`;
    const filepath = path.join(__dirname, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ success: false, message: '해당 할일을 찾을 수 없습니다.' });
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    const todo = parseTodoFile(filename, content);

    // 상태 토글
    const newDone = !todo.done;
    const newContent = buildTodoContent(todo.text, todo.date, newDone, todo.details);
    fs.writeFileSync(filepath, newContent, 'utf-8');

    todo.done = newDone;
    res.json({ success: true, data: todo });
  } catch (err) {
    res.status(500).json({ success: false, message: '상태 변경에 실패했습니다.' });
  }
});

// DELETE /api/todos/:id — 할일 삭제 (.txt 파일 삭제)
app.delete('/api/todos/:id', (req, res) => {
  try {
    const { id } = req.params;
    const filename = `${id}.txt`;
    const filepath = path.join(__dirname, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ success: false, message: '해당 할일을 찾을 수 없습니다.' });
    }

    fs.unlinkSync(filepath);
    res.json({ success: true, message: `${filename} 삭제 완료` });
  } catch (err) {
    res.status(500).json({ success: false, message: '삭제에 실패했습니다.' });
  }
});

// --- Local / Vercel dual-mode ---
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
module.exports = app;
