const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// 미들웨어
// ========================================
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ========================================
// 🗂️ 포켓몬 데이터 (인메모리)
// ========================================
let pokemon = [
  { id: 1, name: "이상해씨", nameEn: "Bulbasaur", type: "풀", color: "#78C850" },
  { id: 4, name: "파이리", nameEn: "Charmander", type: "불꽃", color: "#F08030" },
  { id: 7, name: "꼬부기", nameEn: "Squirtle", type: "물", color: "#6890F0" },
  { id: 25, name: "피카츄", nameEn: "Pikachu", type: "전기", color: "#F8D030" },
  { id: 39, name: "푸린", nameEn: "Jigglypuff", type: "노말", color: "#A8A878" },
  { id: 94, name: "팬텀", nameEn: "Gengar", type: "고스트", color: "#705898" },
  { id: 133, name: "이브이", nameEn: "Eevee", type: "노말", color: "#A8A878" },
  { id: 143, name: "잠만보", nameEn: "Snorlax", type: "노말", color: "#A8A878" },
  { id: 150, name: "뮤츠", nameEn: "Mewtwo", type: "에스퍼", color: "#F85888" },
  { id: 152, name: "치코리타", nameEn: "Chikorita", type: "풀", color: "#78C850" },
];

// ========================================
// 📡 API 엔드포인트
// ========================================

// 전체 포켓몬 목록 (검색 쿼리 지원)
app.get('/api/pokemon', (req, res) => {
  try {
    const { q } = req.query;
    let result = pokemon;

    if (q) {
      const query = q.trim().toLowerCase();
      result = pokemon.filter(
        (p) =>
          p.name.includes(query) ||
          p.nameEn.toLowerCase().includes(query) ||
          p.type.includes(query) ||
          String(p.id).includes(query)
      );
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 특정 포켓몬 조회
app.get('/api/pokemon/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const found = pokemon.find((p) => p.id === id);

    if (!found) {
      return res.status(404).json({ success: false, message: '포켓몬을 찾을 수 없습니다.' });
    }

    res.json({ success: true, data: found });
  } catch (err) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// ========================================
// SPA 폴백
// ========================================
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ========================================
// 서버 시작
// ========================================
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
module.exports = app;
