const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: "postgresql://postgres.pibwjwqwqgitygeicsco:8j30cDGjmKfd13wA@aws-1-us-east-1.pooler.supabase.com:6543/postgres"
});

async function run() {
  const sql = fs.readFileSync('./schema.sql', 'utf-8');
  try {
    await pool.query(sql);
    console.log('All tables created successfully!');

    const res = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name LIKE 'ecom_%' ORDER BY table_name
    `);
    console.log('Created tables:');
    res.rows.forEach(r => console.log('  -', r.table_name));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

run();
