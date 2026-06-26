import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { processResume } from './resume-processor';
import { ResumeData } from './types';

const app = express();
const PORT = 3001;

// ── 中间件 ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── 文件上传配置 ─────────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

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

// ── 内存存储（后续换数据库） ─────────────────────────────
const resumeStore: ResumeData[] = [];

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
    resumeStore.push(resume);

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
    name: r.name,
    phone: r.phone,
    email: r.email,
    education: r.education,
    school: r.school,
    skills: r.skills,
    sourceFormat: r.sourceFormat,
    confidence: r.confidence,
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

// ── 启动 ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
