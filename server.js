const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8082;
const DATA_FILE = path.join(__dirname, 'data', 'submissions.json');
const AHEAD_DATA_FILE = path.join(__dirname, 'data', 'ahead-submissions.json');
const ADMIN_PASSWORD = 'scalpit2024';
const AHEAD_ADMIN_PASSWORD = 'ahead2024';

app.use(express.json());
// 상담 폼 (우선순위 높음)
app.use(express.static(path.join(__dirname, 'public')));
// 기존 스칼프잇 가맹 사이트
app.use(express.static('/Users/kohanbin/scalpit-franchise'));

function readSubmissions() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
}

function saveSubmissions(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function readAheadSubmissions() {
  if (!fs.existsSync(AHEAD_DATA_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(AHEAD_DATA_FILE, 'utf8')); } catch { return []; }
}

function saveAheadSubmissions(data) {
  fs.writeFileSync(AHEAD_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// 폼 제출
app.post('/api/submit', (req, res) => {
  const body = req.body;
  if (!body.name || !body.phone) {
    return res.status(400).json({ success: false, message: '필수 항목을 입력해주세요.' });
  }

  const submissions = readSubmissions();
  const entry = {
    id: Date.now(),
    submittedAt: new Date().toISOString(),
    reservationType: body.reservationType,
    consultationType: body.consultationType,
    name: body.name,
    birthdate: body.birthdate,
    phone: body.phone,
    address: body.address,
    treatmentHistory: body.treatmentHistory || [],
    visitSource: body.visitSource,
    scalpConcerns: body.scalpConcerns || [],
    permDyeHistory: body.permDyeHistory,
    shampooFrequency: body.shampooFrequency,
    desiredServices: body.desiredServices || [],
    videoConsent: body.videoConsent,
  };
  submissions.push(entry);
  saveSubmissions(submissions);

  res.json({ success: true, message: '설문이 접수되었습니다. 감사합니다!' });
});

// 어드민 - 전체 조회
app.get('/api/submissions', (req, res) => {
  const pw = req.headers['x-admin-password'];
  if (pw !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: '비밀번호가 올바르지 않습니다.' });
  }
  const submissions = readSubmissions();
  res.json({ success: true, data: submissions, total: submissions.length });
});

// 어드민 - 단건 삭제
app.delete('/api/submissions/:id', (req, res) => {
  const pw = req.headers['x-admin-password'];
  if (pw !== ADMIN_PASSWORD) return res.status(401).json({ success: false });
  const id = Number(req.params.id);
  const submissions = readSubmissions().filter(s => s.id !== id);
  saveSubmissions(submissions);
  res.json({ success: true });
});

// ── aHEAD API ──
app.post('/api/ahead/submit', (req, res) => {
  const body = req.body;
  if (!body.name || !body.phone) {
    return res.status(400).json({ success: false, message: '필수 항목을 입력해주세요.' });
  }
  const submissions = readAheadSubmissions();
  const entry = {
    id: Date.now(),
    submittedAt: new Date().toISOString(),
    reservationType: body.reservationType,
    consultationType: body.consultationType,
    name: body.name,
    birthdate: body.birthdate,
    phone: body.phone,
    address: body.address,
    treatmentHistory: body.treatmentHistory || [],
    visitSource: body.visitSource,
    scalpConcerns: body.scalpConcerns || [],
    permDyeHistory: body.permDyeHistory,
    shampooFrequency: body.shampooFrequency,
    desiredServices: body.desiredServices || [],
    videoConsent: body.videoConsent,
  };
  submissions.push(entry);
  saveAheadSubmissions(submissions);
  res.json({ success: true, message: '설문이 접수되었습니다. 감사합니다!' });
});

app.get('/api/ahead/submissions', (req, res) => {
  const pw = req.headers['x-admin-password'];
  if (pw !== AHEAD_ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: '비밀번호가 올바르지 않습니다.' });
  }
  const submissions = readAheadSubmissions();
  res.json({ success: true, data: submissions, total: submissions.length });
});

app.delete('/api/ahead/submissions/:id', (req, res) => {
  const pw = req.headers['x-admin-password'];
  if (pw !== AHEAD_ADMIN_PASSWORD) return res.status(401).json({ success: false });
  const id = Number(req.params.id);
  const submissions = readAheadSubmissions().filter(s => s.id !== id);
  saveAheadSubmissions(submissions);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`✅ SCALPIT 상담 서버 실행 중: http://localhost:${PORT}`);
  console.log(`📋 어드민 페이지: http://localhost:${PORT}/admin.html`);
  console.log(`🔑 어드민 비밀번호: ${ADMIN_PASSWORD}`);
});
