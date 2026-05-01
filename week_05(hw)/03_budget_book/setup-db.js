const { Client } = require('pg');
require('dotenv/config');

const DATABASE_URL = process.env.DATABASE_URL;

async function setup() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to database');

  // 스키마 생성
  await client.query(`
    DROP TABLE IF EXISTS budget_entries;

    CREATE TABLE budget_entries (
      id          SERIAL PRIMARY KEY,
      date        DATE NOT NULL,
      category    VARCHAR(20) NOT NULL,
      name        VARCHAR(100) NOT NULL,
      amount      INTEGER NOT NULL CHECK (amount >= 0),
      memo        VARCHAR(200) DEFAULT '',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_budget_category ON budget_entries(category);
    CREATE INDEX idx_budget_date ON budget_entries(date);
  `);
  console.log('Table created');

  // 데모 데이터 삽입 (30건)
  const demos = [
    // 식비
    ['2026-04-01', '식비',  '점심 김치찌개',     9000,  '회사 근처 식당'],
    ['2026-04-03', '식비',  '저녁 삼겹살',      32000,  '친구 모임'],
    ['2026-04-05', '식비',  '카페 아메리카노',    4500,  ''],
    ['2026-04-08', '식비',  '편의점 도시락',      4200,  '야근'],
    ['2026-04-12', '식비',  '마트 장보기',       67000,  '주간 식재료'],
    ['2026-04-15', '식비',  '점심 국밥',          8500,  ''],
    ['2026-04-19', '식비',  '치킨 배달',         22000,  '주말'],
    ['2026-04-25', '식비',  '스타벅스',           6300,  '카페라떼+케이크'],
    // 교통
    ['2026-04-02', '교통',  '지하철 충전',       50000,  '교통카드'],
    ['2026-04-10', '교통',  '택시',             12000,  '야근 귀가'],
    ['2026-04-20', '교통',  '주유',             70000,  '경유'],
    ['2026-04-28', '교통',  'KTX 서울-부산',    59800,  '출장'],
    // 쇼핑
    ['2026-04-03', '쇼핑',  '운동화',           89000,  '나이키 세일'],
    ['2026-04-11', '쇼핑',  'USB 케이블',        8900,  '쿠팡'],
    ['2026-04-22', '쇼핑',  '여름 반팔 2장',     35000,  '유니클로'],
    // 문화
    ['2026-04-05', '문화',  '영화 관람',         14000,  '2인'],
    ['2026-04-16', '문화',  '책 구매',           18000,  '교보문고'],
    ['2026-04-27', '문화',  '넷플릭스 구독',     17000,  '월 정기결제'],
    // 의료
    ['2026-04-06', '의료',  '감기약',             5500,  '약국'],
    ['2026-04-18', '의료',  '치과 스케일링',      15000,  '6개월 정기'],
    // 주거
    ['2026-04-07', '주거',  '전기요금',          45000,  '4월분'],
    ['2026-04-07', '주거',  '수도요금',          18000,  '4월분'],
    ['2026-04-07', '주거',  '가스요금',          12000,  '4월분'],
    ['2026-04-30', '주거',  '월세',            500000,  '5월분 선납'],
    // 통신
    ['2026-04-09', '통신',  '휴대폰 요금',       55000,  '자동이체'],
    ['2026-04-09', '통신',  '인터넷 요금',       33000,  '자동이체'],
    // 기타
    ['2026-04-14', '기타',  '경조사비',          50000,  '결혼식 축의금'],
    ['2026-04-21', '기타',  '세탁소',             8000,  '코트 드라이클리닝'],
    ['2026-04-24', '기타',  '미용실',            20000,  '커트'],
    ['2026-04-29', '기타',  '보험료',           120000,  '실비보험 월납'],
  ];

  const insertQuery = `
    INSERT INTO budget_entries (date, category, name, amount, memo)
    VALUES ($1, $2, $3, $4, $5)
  `;

  for (const row of demos) {
    await client.query(insertQuery, row);
  }
  console.log(`${demos.length}건 데모 데이터 삽입 완료`);

  // 확인
  const result = await client.query(`
    SELECT category, COUNT(*) as cnt, SUM(amount) as total
    FROM budget_entries
    GROUP BY category
    ORDER BY total DESC
  `);
  console.log('\n카테고리별 요약:');
  console.table(result.rows);

  const totalResult = await client.query('SELECT SUM(amount) as grand_total FROM budget_entries');
  console.log(`총 합계: ${Number(totalResult.rows[0].grand_total).toLocaleString()}원`);

  await client.end();
}

setup().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
