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

  // 테이블 생성
  await client.query(`
    DROP TABLE IF EXISTS community_posts;
    DROP TABLE IF EXISTS community_users;

    CREATE TABLE community_users (
      id        SERIAL PRIMARY KEY,
      username  VARCHAR(50) UNIQUE NOT NULL,
      password  VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE community_posts (
      id         SERIAL PRIMARY KEY,
      title      VARCHAR(200) NOT NULL,
      content    TEXT NOT NULL,
      author_id  INTEGER REFERENCES community_users(id),
      author     VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_posts_author ON community_posts(author_id);
    CREATE INDEX idx_posts_created ON community_posts(created_at DESC);
  `);
  console.log('Tables created');

  // 샘플 유저 (비번: 1234)
  const hash = await bcrypt.hash('1234', 10);
  const users = ['김태민', '이서준', '박지우'];
  for (const u of users) {
    await client.query(
      'INSERT INTO community_users (username, password) VALUES ($1, $2)',
      [u, hash]
    );
  }
  console.log('Users created (password: 1234)');

  // 샘플 게시글
  const posts = [
    [1, '김태민', '오늘 날씨가 너무 좋네요', '산책 다녀왔는데 벚꽃이 아직 남아있었어요. 올해는 좀 늦게까지 피는 것 같습니다. 혹시 근처에 좋은 산책로 아시는 분 있나요?'],
    [1, '김태민', '추천 맛집 공유합니다', '강남역 근처에 새로 생긴 파스타집인데 정말 맛있어요. 토마토 파스타가 특히 좋았습니다. 가격도 12,000원이라 합리적이에요.'],
    [2, '이서준', '주말에 뭐하세요?', '이번 주말에 시간이 비는데 뭐 할지 고민이에요. 영화 보러 갈까 하는데 요즘 볼만한 영화 있나요? 추천 부탁드립니다!'],
    [2, '이서준', '코딩 공부 질문이요', 'JavaScript에서 async/await 쓸 때 에러 처리는 어떻게 하시나요? try-catch를 매번 감싸는 게 맞는지 아니면 다른 방법이 있는지 궁금합니다.'],
    [3, '박지우', '운동 루틴 공유', '요즘 시작한 운동 루틴입니다.\n\n1. 스쿼트 3세트 x 15회\n2. 플랭크 3세트 x 1분\n3. 런지 3세트 x 12회\n4. 버피 3세트 x 10회\n\n초보자도 할 수 있어서 추천드려요!'],
    [3, '박지우', '독서 모임 하실 분?', '매주 토요일 오후에 카페에서 독서 모임을 하고 있는데 같이 하실 분 계신가요? 장르 상관없이 편하게 읽고 이야기 나누는 모임입니다.'],
    [1, '김태민', 'React vs Vue 어떤 걸 배울까요', '프론트엔드 프레임워크를 하나 배우려고 하는데 React랑 Vue 중에 고민이에요. 취업 시장에서는 React가 더 많은 것 같은데 Vue가 배우기 쉽다고 하더라고요. 경험자분들 의견 부탁드립니다.'],
    [2, '이서준', '카페 추천해주세요', '조용히 작업하기 좋은 카페 찾고 있습니다. 콘센트 있고 와이파이 빠른 곳이면 좋겠어요. 서울 기준으로 추천 부탁드립니다!'],
    [3, '박지우', '요리 초보 팁', '자취 시작하면서 요리를 배우고 있는데 생각보다 어렵네요. 간단하면서 맛있는 레시피 있으면 공유해주세요! 특히 한 그릇 요리가 좋아요.'],
    [1, '김태민', '면접 후기', '오늘 면접 다녀왔습니다. 기술 면접에서 예상 못한 질문이 나와서 당황했는데 어떻게든 대답은 했네요. 결과는 다음 주에 나온다고 합니다. 다들 응원해주세요!'],
  ];

  for (const [authorId, author, title, content] of posts) {
    await client.query(
      'INSERT INTO community_posts (author_id, author, title, content) VALUES ($1, $2, $3, $4)',
      [authorId, author, title, content]
    );
  }
  console.log(`${posts.length}개 게시글 삽입 완료`);

  const result = await client.query('SELECT COUNT(*) FROM community_posts');
  console.log(`총 게시글: ${result.rows[0].count}개`);
  console.log('\n테스트 계정: 김태민 / 이서준 / 박지우 (비밀번호: 1234)');

  await client.end();
}

setup().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
