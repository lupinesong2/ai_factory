require('dotenv').config();
const express = require('express');
const { Pool, types } = require('pg');
const OpenAI = require('openai');
const path = require('path');

types.setTypeParser(1082, val => val);

const app = express();
const PORT = process.env.PORT || 3002;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 가계부 데이터 조회
async function getBudgetData() {
  const entries = await pool.query(
    'SELECT id, date, category, name, amount, memo FROM budget_entries ORDER BY date DESC'
  );
  const summary = await pool.query(`
    SELECT category, COUNT(*)::int AS count, SUM(amount)::int AS total
    FROM budget_entries GROUP BY category ORDER BY total DESC
  `);
  const grand = await pool.query('SELECT SUM(amount)::int AS total FROM budget_entries');

  return {
    entries: entries.rows,
    summary: summary.rows,
    grandTotal: grand.rows[0].total,
  };
}

// 시스템 프롬프트
const SYSTEM_PROMPT = `너는 **짠돌이 어드바이저**야. 전설적인 절약왕 재무 상담사로, 불필요한 지출을 보면 몸이 움찔할 정도로 아까워하는 캐릭터야.

## 성격 & 말투
- 돈 낭비를 보면 진심으로 가슴이 아프다 — "이게 말이 됩니까?" "아이고..." "이러면 안 됩니다"
- 잘한 부분은 확실히 칭찬한다 — "오, 이건 잘하셨습니다!" "훌륭합니다!"
- 무조건 안 쓰라는 게 아니라, **더 나은 대안**을 항상 제시한다
- 절약하면 얼마를 아끼는지 **구체적인 숫자**로 계산해준다
- 금액은 항상 쉼표 포함 (예: 153,500원)
- 이모지를 적절히 활용한다 (💸😱💪✅)

## 분석 프레임워크 (전체 분석 요청 시)
1. 📊 **현황 리포트** — 총 지출, 카테고리별 금액/비중, TOP 5 항목, 일평균
2. 🔍 **짠돌이의 진단** — 카테고리별 평가, 문제 항목 지적
3. 💡 **이렇게 하면 아낍니다** — 구체적 절약법, 대체재, 예상 절약 금액
4. ⭐ **짠돌이 점수** — 100점 만점 점수, 한줄 총평, 다음 달 목표

## 주의사항
- 주거비(월세, 공과금), 의료비, 보험료 같은 고정비/필수 지출은 인정한다
- 특정 카테고리 질문이면 해당 카테고리만 집중 분석
- 응답은 항상 한국어
- 마크다운 형식으로 응답 (제목, 표, 볼드 등 활용)`;

// 채팅 API
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    // DB에서 최신 데이터 조회
    const budgetData = await getBudgetData();
    const dataContext = `
[현재 가계부 데이터]
총 지출: ${budgetData.grandTotal.toLocaleString()}원

카테고리별 요약:
${budgetData.summary.map(s => `- ${s.category}: ${s.total.toLocaleString()}원 (${s.count}건)`).join('\n')}

전체 항목 (${budgetData.entries.length}건):
${budgetData.entries.map(e => `- ${e.date} | ${e.category} | ${e.name} | ${e.amount.toLocaleString()}원 | ${e.memo || ''}`).join('\n')}
`;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + '\n\n' + dataContext },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.8,
      max_tokens: 2000,
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 요약 데이터 API (대시보드용)
app.get('/api/summary', async (req, res) => {
  try {
    const data = await getBudgetData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Budget Advisor running on http://localhost:${PORT}`);
});
