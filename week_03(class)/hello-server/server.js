const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- In-memory data store ---
let users = [
  { id: 1, name: 'Alice Kim', email: 'alice@example.com' },
  { id: 2, name: 'Bob Park', email: 'bob@example.com' },
  { id: 3, name: 'Charlie Lee', email: 'charlie@example.com' },
  { id: 4, name: 'Diana Choi', email: 'diana@example.com' }
];
let nextUserId = 5;

let todos = [
  { id: 1, title: '장보기 - 우유, 계란, 빵', completed: false },
  { id: 2, title: 'Express.js 공부하기', completed: true },
  { id: 3, title: '운동 30분 하기', completed: false },
  { id: 4, title: '프로젝트 README 작성', completed: true }
];
let nextTodoId = 5;

let notes = [
  { id: 1, title: '회의 메모', content: '다음 주 월요일까지 API 설계 완료하기. 팀원들과 역할 분담 필요.', createdAt: '2026-04-10T09:00:00.000Z' },
  { id: 2, title: '공부 노트', content: 'REST API의 핵심: 자원(Resource)을 URI로 표현하고 HTTP 메서드로 행위를 정의한다.', createdAt: '2026-04-10T14:30:00.000Z' },
  { id: 3, title: '아이디어 정리', content: '날씨 API와 할 일 목록을 결합한 앱 만들어보기. 비 오는 날엔 실내 할 일 추천.', createdAt: '2026-04-11T08:00:00.000Z' }
];
let nextNoteId = 4;

const quotes = [
  { text: '천 리 길도 한 걸음부터.', author: '노자' },
  { text: '배움에는 왕도가 없다.', author: '유클리드' },
  { text: '오늘 할 수 있는 일을 내일로 미루지 마라.', author: '벤자민 프랭클린' },
  { text: '실패는 성공의 어머니이다.', author: '속담' },
  { text: '아는 것이 힘이다.', author: '프랜시스 베이컨' },
  { text: '뜻이 있는 곳에 길이 있다.', author: '속담' }
];

// --- API Routes ---

// GET /api/hello
app.get('/api/hello', (_req, res) => {
  res.json({ success: true, data: { message: 'Hello, World!' } });
});

// GET /api/time
app.get('/api/time', (_req, res) => {
  res.json({ success: true, data: { time: new Date().toISOString() } });
});

// POST /api/echo
app.post('/api/echo', (req, res) => {
  res.json({ success: true, data: req.body });
});

// GET /api/users
app.get('/api/users', (_req, res) => {
  res.json({ success: true, data: users });
});

// POST /api/users
app.post('/api/users', (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'name and email are required' });
  }

  const newUser = { id: nextUserId++, name, email };
  users.push(newUser);
  res.status(201).json({ success: true, data: newUser });
});

// DELETE /api/users/:id
app.delete('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = users.findIndex(u => u.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: `User with id ${id} not found` });
  }

  const deleted = users.splice(index, 1)[0];
  res.json({ success: true, data: deleted });
});

// =====================
// Todos CRUD
// =====================

// GET /api/todos
app.get('/api/todos', (_req, res) => {
  res.json({ success: true, data: todos });
});

// POST /api/todos
app.post('/api/todos', (req, res) => {
  const { title, completed } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, message: 'title is required' });
  }

  const newTodo = { id: nextTodoId++, title, completed: completed || false };
  todos.push(newTodo);
  res.status(201).json({ success: true, data: newTodo });
});

// PUT /api/todos/:id
app.put('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const todo = todos.find(t => t.id === id);

  if (!todo) {
    return res.status(404).json({ success: false, message: `Todo with id ${id} not found` });
  }

  const { title, completed } = req.body;
  if (title !== undefined) todo.title = title;
  if (completed !== undefined) todo.completed = completed;

  res.json({ success: true, data: todo });
});

// DELETE /api/todos/:id
app.delete('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = todos.findIndex(t => t.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: `Todo with id ${id} not found` });
  }

  const deleted = todos.splice(index, 1)[0];
  res.json({ success: true, data: deleted });
});

// =====================
// Notes CRUD
// =====================

// GET /api/notes
app.get('/api/notes', (_req, res) => {
  res.json({ success: true, data: notes });
});

// GET /api/notes/:id
app.get('/api/notes/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const note = notes.find(n => n.id === id);

  if (!note) {
    return res.status(404).json({ success: false, message: `Note with id ${id} not found` });
  }

  res.json({ success: true, data: note });
});

// POST /api/notes
app.post('/api/notes', (req, res) => {
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ success: false, message: 'title and content are required' });
  }

  const newNote = { id: nextNoteId++, title, content, createdAt: new Date().toISOString() };
  notes.push(newNote);
  res.status(201).json({ success: true, data: newNote });
});

// PUT /api/notes/:id
app.put('/api/notes/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const note = notes.find(n => n.id === id);

  if (!note) {
    return res.status(404).json({ success: false, message: `Note with id ${id} not found` });
  }

  const { title, content } = req.body;
  if (title !== undefined) note.title = title;
  if (content !== undefined) note.content = content;

  res.json({ success: true, data: note });
});

// DELETE /api/notes/:id
app.delete('/api/notes/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = notes.findIndex(n => n.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: `Note with id ${id} not found` });
  }

  const deleted = notes.splice(index, 1)[0];
  res.json({ success: true, data: deleted });
});

// =====================
// Search API
// =====================

// GET /api/search?q=keyword
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();

  if (!q) {
    return res.status(400).json({ success: false, message: 'query parameter "q" is required' });
  }

  const matchedUsers = users.filter(u =>
    u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  );
  const matchedTodos = todos.filter(t =>
    t.title.toLowerCase().includes(q)
  );
  const matchedNotes = notes.filter(n =>
    n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
  );

  res.json({
    success: true,
    data: {
      query: q,
      results: { users: matchedUsers, todos: matchedTodos, notes: matchedNotes },
      totalCount: matchedUsers.length + matchedTodos.length + matchedNotes.length
    }
  });
});

// =====================
// Stats API
// =====================

// GET /api/stats
app.get('/api/stats', (_req, res) => {
  res.json({
    success: true,
    data: {
      users: users.length,
      todos: { total: todos.length, completed: todos.filter(t => t.completed).length },
      notes: notes.length
    }
  });
});

// =====================
// Random Data API
// =====================

// GET /api/random/quote
app.get('/api/random/quote', (_req, res) => {
  const quote = quotes[Math.floor(Math.random() * quotes.length)];
  res.json({ success: true, data: quote });
});

// GET /api/random/number?min=1&max=100
app.get('/api/random/number', (req, res) => {
  const min = parseInt(req.query.min, 10) || 1;
  const max = parseInt(req.query.max, 10) || 100;

  if (min > max) {
    return res.status(400).json({ success: false, message: 'min must be less than or equal to max' });
  }

  const number = Math.floor(Math.random() * (max - min + 1)) + min;
  res.json({ success: true, data: { min, max, number } });
});

// =====================
// Calculator API
// =====================

// POST /api/calc
app.post('/api/calc', (req, res) => {
  const { a, b, op } = req.body;

  if (a === undefined || b === undefined || !op) {
    return res.status(400).json({ success: false, message: 'a, b, and op are required' });
  }

  if (typeof a !== 'number' || typeof b !== 'number') {
    return res.status(400).json({ success: false, message: 'a and b must be numbers' });
  }

  let result;
  switch (op) {
    case 'add':
      result = a + b;
      break;
    case 'subtract':
      result = a - b;
      break;
    case 'multiply':
      result = a * b;
      break;
    case 'divide':
      if (b === 0) {
        return res.status(400).json({ success: false, message: 'Cannot divide by zero' });
      }
      result = a / b;
      break;
    default:
      return res.status(400).json({ success: false, message: `Unknown operation "${op}". Use: add, subtract, multiply, divide` });
  }

  res.json({ success: true, data: { a, b, op, result } });
});

// --- Error handling ---
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// --- Start server / Export for Vercel ---
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
module.exports = app;
