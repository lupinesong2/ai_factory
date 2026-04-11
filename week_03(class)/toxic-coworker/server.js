const express = require('express');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// OpenAI 클라이언트 초기화
// ========================================

const openai = new OpenAI({
  apiKey: (process.env.OPENAI_API_KEY || '').trim(),
});

// ========================================
// 미들웨어
// ========================================

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ========================================
// 카테고리별 시스템 프롬프트
// ========================================

const SYSTEM_PROMPTS = {
  gaslighting: `당신은 "멘탈지킴이"라는 이름의 직장 내 가스라이팅 대응 전문 심리상담사입니다.
- 상담자가 가스라이팅 상사로 인해 겪는 고충을 공감하고, 실질적인 대응 전략을 제시합니다.
- 상담자의 판단이 옳다는 것을 확인시켜주고, 자존감을 회복할 수 있도록 돕습니다.
- "사실 기반 기록", "메일/메신저로 확인", "HR 상담" 등 구체적 행동 방안을 안내합니다.
- 따뜻하지만 전문적인 톤을 유지하며, 적절한 이모지를 사용합니다.
- 답변은 2~4문장으로 간결하게 합니다.`,

  'credit-steal': `당신은 "멘탈지킴이"라는 이름의 직장 내 공 빼기(성과 가로채기) 대응 전문 심리상담사입니다.
- 노력한 성과를 빼앗긴 상담자의 억울함에 공감하고, 성과를 지키는 전략을 제시합니다.
- "기록 남기기", "공개적 장에서 기여 가시화", "CC 활용" 등 실전 팁을 안내합니다.
- 감정적 대응보다 전략적 대응을 권장합니다.
- 따뜻하지만 전문적인 톤을 유지하며, 적절한 이모지를 사용합니다.
- 답변은 2~4문장으로 간결하게 합니다.`,

  gossip: `당신은 "멘탈지킴이"라는 이름의 직장 내 뒷담화 대응 전문 심리상담사입니다.
- 뒷담화로 인한 스트레스와 고립감에 깊이 공감합니다.
- "무관심 + 실력 증명" 전략과 필요시 "사실 기반 HR 신고" 방법을 안내합니다.
- 소문에 휘둘리지 않도록 멘탈 관리 방법을 조언합니다.
- 따뜻하지만 전문적인 톤을 유지하며, 적절한 이모지를 사용합니다.
- 답변은 2~4문장으로 간결하게 합니다.`,

  dumper: `당신은 "멘탈지킴이"라는 이름의 직장 내 업무 떠넘기기 대응 전문 심리상담사입니다.
- 과도한 업무 부담과 거절의 어려움에 공감합니다.
- "건강한 경계 설정", "구체적 이유 + 대안 제시형 거절", "업무 분장 명확화" 전략을 안내합니다.
- NO라고 말하는 것이 건강한 직장생활의 일부임을 강조합니다.
- 따뜻하지만 전문적인 톤을 유지하며, 적절한 이모지를 사용합니다.
- 답변은 2~4문장으로 간결하게 합니다.`,

  emotional: `당신은 "멘탈지킴이"라는 이름의 직장 내 감정 기복 동료 대응 전문 심리상담사입니다.
- 감정 기복이 심한 동료로 인한 긴장감과 피로에 공감합니다.
- "일정한 거리 유지", "업무 소통 문서화", "감정 패턴 관찰" 전략을 안내합니다.
- 상대의 감정은 상담자의 책임이 아님을 분명히 합니다.
- 따뜻하지만 전문적인 톤을 유지하며, 적절한 이모지를 사용합니다.
- 답변은 2~4문장으로 간결하게 합니다.`,
};

const DEFAULT_SYSTEM = `당신은 "멘탈지킴이"라는 이름의 회사 빌런 대응 전문 심리상담사입니다.
직장에서 힘든 상황을 겪는 분들에게 공감하고, 실질적인 대응 전략을 제시합니다.
따뜻하지만 전문적인 톤으로 답변하며, 2~4문장으로 간결하게 합니다.
적절한 이모지를 사용합니다.`;

// ========================================
// 대화 히스토리 (인메모리)
// ========================================

const conversations = new Map();

// ========================================
// API 엔드포인트
// ========================================

app.post('/api/chat', async (req, res) => {
  try {
    const { message, category, sessionId } = req.body;

    if (!message || !category) {
      return res.status(400).json({ success: false, message: '메시지와 카테고리가 필요합니다.' });
    }

    const sid = sessionId || `session-${Date.now()}`;
    const systemPrompt = SYSTEM_PROMPTS[category] || DEFAULT_SYSTEM;

    // 대화 히스토리 가져오기 또는 새로 생성
    if (!conversations.has(sid)) {
      conversations.set(sid, [{ role: 'system', content: systemPrompt }]);
    }

    const history = conversations.get(sid);
    history.push({ role: 'user', content: message });

    // 최근 20개 메시지만 유지 (시스템 프롬프트 + 최근 대화)
    const trimmed = [history[0], ...history.slice(-19)];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: trimmed,
      max_tokens: 300,
      temperature: 0.8,
    });

    const reply = completion.choices[0].message.content;
    history.push({ role: 'assistant', content: reply });

    // 히스토리가 너무 길어지면 정리
    if (history.length > 40) {
      const system = history[0];
      conversations.set(sid, [system, ...history.slice(-20)]);
    }

    res.json({ success: true, data: { reply, sessionId: sid } });
  } catch (err) {
    console.error('OpenAI API 오류:', err.message);

    if (err.status === 401) {
      return res.status(401).json({ success: false, message: 'API 키가 유효하지 않습니다.' });
    }
    if (err.status === 429) {
      return res.status(429).json({ success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
    }

    res.status(500).json({ success: false, message: 'AI 응답 생성에 실패했습니다.' });
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
  app.listen(PORT, () => console.log(`멘탈지킴이 서버 실행 중: http://localhost:${PORT}`));
}
module.exports = app;
