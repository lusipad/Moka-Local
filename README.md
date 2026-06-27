# Moka-Local — 本地简历管理系统

对接 Moka 招聘系统的本地简历处理工具，支持 PDF / 图片 / Word (.docx / .doc) 多种格式上传，自动 OCR 解析并提取结构化信息，支持一键同步至 Moka。

## 设计思路

### 为什么做这个

日常招聘场景中，HR 从各种渠道收到简历（微信、邮件、招聘网站），格式五花八门：拍照的截图、扫描的 PDF、旧版 .doc 文件。每次都手动录入 Moka 低效且易出错。这个系统就是解决"最后一公里"的简历录入问题。

### 架构分层

```
┌──────────────────────────────────────┐
│           浏览器前端 (SPA)             │
│      上传 → 解析预览 → 同步 Moka       │
└──────────────┬───────────────────────┘
               │ REST API
┌──────────────▼───────────────────────┐
│      Express 后端 (TypeScript)        │
│                                       │
│  ┌─────────┐  ┌──────────────────┐   │
│  │ parsers │  │   OCR 引擎层      │   │
│  │ · pdf   │  │  · PaddleOCR (默认)│   │
│  │ · docx  │  │  · Tesseract     │   │
│  │ · doc   │  │  · Custom HTTP   │   │
│  │ · image │  │  (可插拔接口)     │   │
│  └────┬────┘  └────────┬─────────┘   │
│       │                │              │
│  ┌────▼────────────────▼──────────┐  │
│  │      resume-processor          │  │
│  │   文本 → 字段提取 → 结构化数据   │  │
│  └────────────┬───────────────────┘  │
│               │                       │
│  ┌────────────▼───────────────────┐  │
│  │       moka-client              │  │
│  │   REST API → Moka 招聘系统      │  │
│  └────────────────────────────────┘  │
└───────────────────────────────────────┘
```

### OCR 引擎选择：为什么用 PaddleOCR

| 引擎 | 优点 | 缺点 |
|------|------|------|
| **PaddleOCR** (默认) | 中文识别率最高；支持倾斜/复杂排版；离线可用 | 安装体积大 (~500MB)；首次启动慢 (模型下载) |
| Tesseract.js | 纯 JS，无需 Python；安装轻量 | 中文识别率明显低于 PaddleOCR；对扫描件不友好 |
| Custom HTTP | 可接入任何云端 OCR API | 需网络、可能有费用 |

默认使用 PaddleOCR，通过 `OCR_ENGINE` 环境变量可切换：
```bash
# .env 文件
OCR_ENGINE=paddleocr   # 默认（推荐）
OCR_ENGINE=tesseract   # 纯 Node.js 备选
OCR_ENGINE=custom      # 自定义 API
OCR_CUSTOM_URL=http://your-ocr-api/recognize
```

### PDF 处理策略

PDF 分两类处理：
1. **文字型 PDF**：直接用 `pdf-parse` 提取文本（毫秒级）
2. **扫描型 PDF**：文本不足 100 字符时 → `pdf2image` (Poppler) 转图片 → PaddleOCR 逐页识别

### 文件格式支持

| 格式 | 解析方式 | 依赖 |
|------|---------|------|
| `.pdf` (文字) | pdf-parse (Node.js) | 无额外依赖 |
| `.pdf` (扫描) | Poppler → 图片 → PaddleOCR | poppler + paddleocr |
| `.png/.jpg/.webp/.bmp` | PaddleOCR 直接识别 | paddleocr |
| `.docx` | mammoth (Node.js) | 无额外依赖 |
| `.doc` | olefile (Python) → 文本提取 | olefile |

## 快速开始

### 方式一：下载 Release（推荐，无需安装 Python）

1. 从 [Releases](https://github.com/lusipad/Moka-Local/releases) 下载 `Moka-Local-windows.zip`
2. 解压到任意目录
3. 双击 `start.bat`，浏览器打开 `http://localhost:3001`

Release 包自带 Python 3.12 + PaddleOCR + Poppler，开箱即用。

### 方式二：从源码运行

```bash
# 1. 克隆
git clone https://github.com/lusipad/Moka-Local.git
cd Moka-Local

# 2. 安装（自动检测/下载 Python 和依赖）
install.bat

# 3. 启动
start.bat

# 访问 http://localhost:3001
```

### 环境要求（源码运行）

- Node.js >= 18
- Python >= 3.10（自动下载，或手动安装）

### 配置 Moka 对接

复制 `.env.example` 为 `.env`，填写 Moka API 凭证：

```env
# Moka API
MOKA_BASE_URL=https://openapi.moka.com
MOKA_APP_ID=your_app_id
MOKA_APP_SECRET=your_app_secret

# Mock 模式（本地测试，不需要真实 Moka 账号）
MOKA_MOCK=true
MOKA_MOCK_PORT=3002
```

不填 Moka 凭证时，系统自动使用本地 Mock 模式，所有同步操作在本地模拟。

## 项目结构

```
Moka-Web/
├── public/              # 前端页面
│   └── index.html       # SPA 单页应用
├── src/
│   ├── server.ts        # Express 主服务 (端口 3001)
│   ├── moka-mock.ts     # Mock Moka 服务 (端口 3002)
│   ├── moka-client.ts   # Moka API 客户端
│   ├── resume-processor.ts  # 简历处理流水线
│   ├── python-path.ts   # Python 路径解析（优先内置）
│   ├── store.ts         # JSON 文件持久化
│   ├── types.ts         # 类型定义
│   ├── ocr/index.ts     # OCR 引擎注册/分发
│   ├── parsers/         # 各格式解析器
│   │   ├── pdf-parser.ts
│   │   ├── image-parser.ts
│   │   ├── word-parser.ts   (.docx)
│   │   └── doc-parser.ts    (.doc)
│   ├── extractors/
│   │   └── field-extractor.ts  # 字段提取（正则）
│   └── ai/index.ts      # AI 增强接口（预留）
├── scripts/
│   ├── ocr.py           # PaddleOCR 桥接脚本
│   └── pdf_to_images.py # PDF → 图片转换（Poppler）
├── install.bat          # 环境安装脚本（自动下载 Python）
├── start.bat            # 启动脚本
└── .github/workflows/
    └── build.yml        # CI: Docker 镜像 + Windows Release
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/upload` | 上传简历文件 (multipart) |
| `GET` | `/api/resumes` | 获取所有简历列表 |
| `GET` | `/api/resumes/:id` | 获取单份简历详情 |
| `DELETE` | `/api/resumes/:id` | 删除简历 |
| `POST` | `/api/resumes/:id/sync` | 同步到 Moka |
| `GET` | `/api/moka/positions` | 获取 Moka 职位列表 |
| `GET` | `/api/moka/config` | 获取 Moka 配置状态 |
| `GET` | `/uploads/:filename` | 访问上传的原始文件 |

## 技术栈

| 层 | 技术 |
|----|------|
| 后端框架 | Express 5 (TypeScript) |
| OCR 引擎 | PaddleOCR (Python 子进程) |
| PDF 解析 | pdf-parse + pdf2image/Poppler |
| Word 解析 | mammoth (.docx) + olefile (.doc) |
| 文件上传 | multer |
| 数据持久化 | JSON 文件 (data/resumes.json) |
| 前端 | 原生 HTML/CSS/JS SPA |
| CI/CD | GitHub Actions (Docker + Windows Release) |