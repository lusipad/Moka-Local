/**
 * OCR 引擎接口 — 可插拔配置
 *
 * 环境变量:
 *   OCR_ENGINE=paddleocr|tesseract|custom     (默认 paddleocr)
 *   OCR_CUSTOM_URL=http://...                  (custom 模式下的 HTTP 端点)
 *   OCR_CUSTOM_KEY=...                         (custom 模式的 API Key)
 *
 * 扩展新引擎: 实现 OcrEngine 接口并注册到 ENGINES map
 */
import { execFile } from 'child_process';
import path from 'path';
import { getPythonCmd } from '../python-path';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const OCR_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'ocr.py');

export interface OcrEngine {
  name: string;
  /** 识别单张图片，返回纯文本 */
  recognize(imagePath: string): Promise<string>;
}

// ── PaddleOCR Engine ─────────────────────────

const paddleEngine: OcrEngine = {
  name: 'paddleocr',
  recognize(imagePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(getPythonCmd(), [OCR_SCRIPT, imagePath], {
        maxBuffer: 50 * 1024 * 1024,
        timeout: 180000,
        encoding: 'buffer',
        env: { ...process.env, PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True' },
      }, (err, stdoutBuf) => {
        const stdout = stdoutBuf ? stdoutBuf.toString('utf-8') : '';
        const jsonLine = stdout.trim().split('\n').pop() || stdout;
        try {
          const data = JSON.parse(jsonLine);
          if (data.error) reject(new Error(data.error));
          else resolve(data.text || '');
        } catch {
          resolve(stdout.trim());
        }
      });
    });
  },
};

// ── Tesseract Engine (Node.js) ───────────────

const tesseractEngine: OcrEngine = {
  name: 'tesseract',
  async recognize(imagePath: string): Promise<string> {
    try {
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(imagePath, 'chi_sim+eng', {
        logger: () => {}, // suppress progress logs
      });
      return result.data.text;
    } catch (err) {
      throw new Error('Tesseract not available. Run: npm install tesseract.js');
    }
  },
};

// ── Custom HTTP Engine ───────────────────────

const customEngine: OcrEngine = {
  name: 'custom',
  async recognize(imagePath: string): Promise<string> {
    const url = process.env.OCR_CUSTOM_URL;
    if (!url) throw new Error('OCR_CUSTOM_URL not set');

    const fs = await import('fs');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const key = process.env.OCR_CUSTOM_KEY;
    if (key) headers['Authorization'] = 'Bearer ' + key;

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        image: base64,
        // Common fields for various OCR APIs
        image_base64: base64,
      }),
    });

    const data = await resp.json() as any;
    // Try various response formats
    return data.text || data.ocr_result || data.result || data.data?.text || JSON.stringify(data);
  },
};

// ── Engine Registry ──────────────────────────

const ENGINES: Record<string, OcrEngine> = {
  paddleocr: paddleEngine,
  tesseract: tesseractEngine,
  custom: customEngine,
};

let _engine: OcrEngine | null = null;

export function getOcrEngine(): OcrEngine {
  if (_engine) return _engine;

  const name = (process.env.OCR_ENGINE || 'paddleocr').toLowerCase();
  const engine = ENGINES[name];
  if (!engine) {
    console.warn(`[ocr] Unknown engine "${name}", falling back to paddleocr`);
    _engine = paddleEngine;
  } else {
    _engine = engine;
  }

  console.log(`[ocr] Using engine: ${_engine.name}`);
  return _engine;
}

/** 注册自定义引擎 */
export function registerEngine(name: string, engine: OcrEngine): void {
  ENGINES[name] = engine;
  _engine = null; // Reset cache
  console.log(`[ocr] Registered engine: ${name}`);
}

export { ENGINES };
