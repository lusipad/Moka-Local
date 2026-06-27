import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

const mockToken = 'mock_moka_' + Date.now();

interface Candidate {
  id: number; name: string; phone: string; email: string;
  education: string; school: string; resumeUrl: string; createdAt: string;
}

interface Position {
  id: number; name: string; department: string; status: string;
}

interface Application {
  id: number; candidateId: number; positionId: number;
  status: string; createdAt: string;
}

const candidates: Candidate[] = [];
const resumes: Record<number, string[]> = {};
const applications: Application[] = [];
let cSeq = 1;
let aSeq = 1;

const positions: Position[] = [
  { id: 1, name: '前端开发工程师', department: '技术部', status: 'open' },
  { id: 2, name: 'Java 后端开发', department: '技术部', status: 'open' },
  { id: 3, name: '产品经理', department: '产品部', status: 'open' },
  { id: 4, name: 'UI 设计师', department: '设计部', status: 'open' },
  { id: 5, name: '数据分析师', department: '数据部', status: 'open' },
  { id: 6, name: '运营专员', department: '运营部', status: 'closed' },
];

app.post('/api/auth/token', (_req, res) => {
  res.json({ code: 0, data: { access_token: mockToken, token_type: 'Bearer', expires_in: 7200 } });
});

app.get('/api/v2/positions', (req, res) => {
  const s = req.query.status as string;
  res.json({ code: 0, data: s ? positions.filter(p => p.status === s) : positions });
});

app.get('/api/v2/positions/:id', (req, res) => {
  const p = positions.find(x => x.id === parseInt(req.params.id));
  if (!p) return res.status(404).json({ code: 404, message: '职位不存在' });
  res.json({ code: 0, data: p });
});

app.post('/api/v2/candidates', (req, res) => {
  const { name, phone, email, education, school, resumeUrl } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ code: 400, message: '姓名和手机号为必填' });
  }
  const exist = candidates.find(c => c.phone === phone);
  if (exist) {
    return res.json({ code: 0, data: exist, message: '候选人已存在（手机号重复）' });
  }
  const c: Candidate = {
    id: cSeq++, name, phone, email: email || '', education: education || '',
    school: school || '', resumeUrl: resumeUrl || '', createdAt: new Date().toISOString(),
  };
  candidates.push(c);
  resumes[c.id] = [];
  console.log('[Moka Mock] Candidate created:', name, phone);
  res.json({ code: 0, data: c });
});

app.get('/api/v2/candidates', (req, res) => {
  const q = (req.query.search as string || '').toLowerCase();
  const list = q
    ? candidates.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q))
    : candidates;
  res.json({ code: 0, data: list });
});

app.get('/api/v2/candidates/:id', (req, res) => {
  const c = candidates.find(x => x.id === parseInt(req.params.id));
  if (!c) return res.status(404).json({ code: 404, message: '候选人不存在' });
  res.json({ code: 0, data: { ...c, resumeCount: resumes[c.id]?.length || 0 } });
});

app.post('/api/v2/candidates/:id/resumes', (req, res) => {
  const id = parseInt(req.params.id);
  const c = candidates.find(x => x.id === id);
  if (!c) return res.status(404).json({ code: 404, message: '候选人不存在' });
  const { resumeUrl } = req.body;
  if (!resumeUrl) return res.status(400).json({ code: 400, message: '缺少 resumeUrl' });
  if (!resumes[id]) resumes[id] = [];
  resumes[id].push(resumeUrl);
  c.resumeUrl = resumeUrl;
  console.log('[Moka Mock] Resume linked:', c.name, resumeUrl);
  res.json({ code: 0, data: { candidateId: id, resumeUrl, count: resumes[id].length } });
});

app.post('/api/v2/applications', (req, res) => {
  const { candidateId, positionId } = req.body;
  if (!candidateId || !positionId) {
    return res.status(400).json({ code: 400, message: '缺少 candidateId 或 positionId' });
  }
  const c = candidates.find(x => x.id === candidateId);
  if (!c) return res.status(404).json({ code: 404, message: '候选人不存在' });
  const p = positions.find(x => x.id === positionId);
  if (!p) return res.status(404).json({ code: 404, message: '职位不存在' });
  if (p.status !== 'open') return res.status(400).json({ code: 400, message: '该职位已关闭' });
  const a: Application = {
    id: aSeq++, candidateId, positionId, status: 'screening', createdAt: new Date().toISOString(),
  };
  applications.push(a);
  console.log('[Moka Mock] Application:', c.name, '->', p.name);
  res.json({ code: 0, data: { ...a, candidateName: c.name, positionName: p.name } });
});

app.get('/api/v2/applications', (_req, res) => {
  const list = applications.map(a => {
    const c = candidates.find(x => x.id === a.candidateId);
    const p = positions.find(x => x.id === a.positionId);
    return { ...a, candidateName: c?.name || '', positionName: p?.name || '' };
  });
  res.json({ code: 0, data: list });
});

app.listen(PORT, () => {
  console.log('[Moka Mock] http://localhost:' + PORT);
  console.log('[Moka Mock] Token:', mockToken);
  console.log('[Moka Mock]', positions.length, 'positions ready');
});
