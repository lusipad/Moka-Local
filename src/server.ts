import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { processResume } from './resume-processor';
import { ResumeData } from './types';
import { loadResumes, saveResumes } from './store';
import { syncResume, getPositions, getApplications, getConfig } from './moka-client';

const app = express();
const PORT = 3001;

// ── 中间件 ──────────────────────────────────────────────
app.use(cors());
app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── 文件上传配置 ─────────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${ts}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.webp', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件格式: ${ext}`));
    }
  },
});

// ── 数据存储（JSON 文件持久化） ──────────────────────────
const resumeStore: ResumeData[] = loadResumes();
console.log(`[store] Loaded ${resumeStore.length} resumes from disk`);

// ── API ─────────────────────────────────────────────────

/** 上传并解析简历 */
app.post('/api/resumes/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '请选择简历文件' });
      return;
    }

    const filePath = req.file.path;
    const resume = await processResume(filePath);

    // 存入内存
    resume.fileName = req.file.originalname;
    resume.sourcePath = req.file.filename;
    resume.createdAt = new Date().toISOString();
    resumeStore.push(resume);
    saveResumes(resumeStore);

    res.json({
      id: resumeStore.length - 1,
      ...resume,
      fileName: req.file.originalname,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    res.status(500).json({ error: msg });
  }
});

/** 获取简历列表 */
app.get('/api/resumes', (_req, res) => {
  res.json(resumeStore.map((r, i) => ({
    id: i,
    ...r,
    syncedToMoka: r.syncedToMoka || false,
    mokaCandidateId: r.mokaCandidateId,
    mokaPositionName: r.mokaPositionName,
  })));
});

/** 获取单份简历详情 */
app.get('/api/resumes/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id < 0 || id >= resumeStore.length) {
    res.status(404).json({ error: '简历不存在' });
    return;
  }
  res.json({ id, ...resumeStore[id] });
});

// ── Moka 同步 ──────────────────────────────────────────
const mokaConfig = getConfig();
console.log(`[moka] Mode: ${mokaConfig.mode}, Base: ${mokaConfig.baseUrl}`);

app.post('/api/resumes/:id/sync-to-moka', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 0 || id >= resumeStore.length) {
      res.status(404).json({ error: '简历不存在' });
      return;
    }

    const resume = resumeStore[id];
    const { positionId } = req.body;
    if (!positionId) {
      res.status(400).json({ error: '请选择职位' });
      return;
    }

    const result = await syncResume(
      {
        name: resume.name,
        phone: resume.phone,
        email: resume.email || '',
        education: resume.education || '',
        school: resume.school || '',
      },
      resume.fileName || ('resume_' + id),
      positionId,
    );

    // 标记本地简历为已同步，持久化
    resume.syncedToMoka = true;
    resume.mokaCandidateId = result.candidate.id;
    resume.mokaPositionName = result.application.positionName;
    saveResumes(resumeStore);

    res.json({
      success: true,
      candidate: result.candidate,
      application: result.application,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '同步失败';
    res.status(500).json({ error: msg });
  }
});

/** Moka 职位列表 */
app.get('/api/moka/positions', async (_req, res) => {
  try {
    const positions = await getPositions();
    res.json({ code: 0, data: positions });
  } catch (err) {
    res.status(500).json({ error: '获取职位失败' });
  }
});

/** Moka 投递记录 */
app.get('/api/moka/applications', async (_req, res) => {
  try {
    const apps = await getApplications();
    res.json({ code: 0, data: apps });
  } catch (err) {
    res.status(500).json({ error: '获取投递记录失败' });
  }
});

// ── 启动 ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
