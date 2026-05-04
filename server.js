const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8082;
const ADMIN_PASSWORD = 'scalpit2024';
const AHEAD_ADMIN_PASSWORD = 'ahead2024';

// PostgreSQL 연결 (없으면 JSON 파일 fallback)
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
}

// JSON 파일 fallback (로컬 개발용)
const fs = require('fs');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'submissions.json');
const AHEAD_DATA_FILE = path.join(DATA_DIR, 'ahead-submissions.json');
const REVIEW_DATA_FILE = path.join(DATA_DIR, 'ahead-reviews.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJson(file) {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// DB 초기화 (테이블 없으면 생성)
async function initDB() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id BIGINT PRIMARY KEY,
      brand TEXT NOT NULL,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      data JSONB NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id BIGINT PRIMARY KEY,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      data JSONB NOT NULL
    );
  `);
}

// 데이터 읽기
async function getSubmissions(brand) {
  if (pool) {
    const res = await pool.query(
      'SELECT id, submitted_at as "submittedAt", data FROM submissions WHERE brand=$1 ORDER BY id ASC',
      [brand]
    );
    return res.rows.map(r => ({ id: r.id, submittedAt: r.submittedAt, ...r.data }));
  }
  return brand === 'ahead' ? readJson(AHEAD_DATA_FILE) : readJson(DATA_FILE);
}

// 데이터 저장
async function saveSubmission(brand, entry) {
  if (pool) {
    const { id, submittedAt, ...data } = entry;
    await pool.query(
      'INSERT INTO submissions (id, brand, submitted_at, data) VALUES ($1, $2, $3, $4)',
      [id, brand, submittedAt, JSON.stringify(data)]
    );
  } else {
    const file = brand === 'ahead' ? AHEAD_DATA_FILE : DATA_FILE;
    const list = readJson(file);
    list.push(entry);
    writeJson(file, list);
  }
}

// 데이터 삭제
async function deleteSubmission(brand, id) {
  if (pool) {
    await pool.query('DELETE FROM submissions WHERE id=$1 AND brand=$2', [id, brand]);
  } else {
    const file = brand === 'ahead' ? AHEAD_DATA_FILE : DATA_FILE;
    writeJson(file, readJson(file).filter(s => s.id !== id));
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 루트 경로는 항상 aHEAD 폼으로 고정
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ahead.html'));
});



// ── Scálpit API ──
app.post('/api/scalpit/submit', async (req, res) => {
  const body = req.body;
  if (!body.name || !body.phone) return res.status(400).json({ success: false, message: '필수 항목을 입력해주세요.' });
  const entry = { id: Date.now(), submittedAt: new Date().toISOString(), ...body };
  await saveSubmission('scalpit', entry);
  res.json({ success: true });
});

app.get('/api/scalpit/submissions', async (req, res) => {
  if (req.headers['x-admin-password'] !== ADMIN_PASSWORD)
    return res.status(401).json({ success: false, message: '비밀번호가 올바르지 않습니다.' });
  const data = await getSubmissions('scalpit');
  res.json({ success: true, data, total: data.length });
});

app.delete('/api/scalpit/submissions/:id', async (req, res) => {
  if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) return res.status(401).json({ success: false });
  await deleteSubmission('scalpit', Number(req.params.id));
  res.json({ success: true });
});

// ── aHEAD API ──
app.post('/api/ahead/submit', async (req, res) => {
  const body = req.body;
  if (!body.name || !body.phone) return res.status(400).json({ success: false, message: '필수 항목을 입력해주세요.' });
  const entry = { id: Date.now(), submittedAt: new Date().toISOString(), ...body };
  await saveSubmission('ahead', entry);
  res.json({ success: true });
});

app.get('/api/ahead/submissions', async (req, res) => {
  if (req.headers['x-admin-password'] !== AHEAD_ADMIN_PASSWORD)
    return res.status(401).json({ success: false, message: '비밀번호가 올바르지 않습니다.' });
  const data = await getSubmissions('ahead');
  res.json({ success: true, data, total: data.length });
});

app.delete('/api/ahead/submissions/:id', async (req, res) => {
  if (req.headers['x-admin-password'] !== AHEAD_ADMIN_PASSWORD) return res.status(401).json({ success: false });
  await deleteSubmission('ahead', Number(req.params.id));
  res.json({ success: true });
});

// ── aHEAD Review API ──
app.post('/api/ahead/review', async (req, res) => {
  const body = req.body;
  if (!body.overallRating) return res.status(400).json({ success: false, message: '전체 만족도를 선택해주세요.' });
  const entry = { id: Date.now(), submittedAt: new Date().toISOString(), ...body };
  if (pool) {
    const { id, submittedAt, ...data } = entry;
    await pool.query('INSERT INTO reviews (id, submitted_at, data) VALUES ($1, $2, $3)', [id, submittedAt, JSON.stringify(data)]);
  } else {
    const list = readJson(REVIEW_DATA_FILE);
    list.push(entry);
    writeJson(REVIEW_DATA_FILE, list);
  }
  res.json({ success: true });
});

app.get('/api/ahead/reviews', async (req, res) => {
  if (req.headers['x-admin-password'] !== AHEAD_ADMIN_PASSWORD)
    return res.status(401).json({ success: false, message: '비밀번호가 올바르지 않습니다.' });
  let data;
  if (pool) {
    const result = await pool.query('SELECT id, submitted_at as "submittedAt", data FROM reviews ORDER BY id ASC');
    data = result.rows.map(r => ({ id: r.id, submittedAt: r.submittedAt, ...r.data }));
  } else {
    data = readJson(REVIEW_DATA_FILE);
  }
  res.json({ success: true, data, total: data.length });
});

app.delete('/api/ahead/reviews/:id', async (req, res) => {
  if (req.headers['x-admin-password'] !== AHEAD_ADMIN_PASSWORD) return res.status(401).json({ success: false });
  if (pool) {
    await pool.query('DELETE FROM reviews WHERE id=$1', [Number(req.params.id)]);
  } else {
    const list = readJson(REVIEW_DATA_FILE).filter(r => r.id !== Number(req.params.id));
    writeJson(REVIEW_DATA_FILE, list);
  }
  res.json({ success: true });
});

// 서버 시작
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
    console.log(`📦 데이터 저장: ${pool ? 'PostgreSQL' : 'JSON 파일'}`);
  });
}).catch(err => {
  console.error('DB 초기화 실패, JSON 파일로 대체:', err.message);
  pool = null;
  app.listen(PORT, () => console.log(`✅ 서버 실행 중 (JSON 모드): http://localhost:${PORT}`));
});
