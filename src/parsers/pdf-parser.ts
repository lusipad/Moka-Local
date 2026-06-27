import fs from 'fs';
import { execFile } from 'child_process';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { ParseResult } from '../types';
import { getOcrEngine } from '../ocr';
import { getPythonCmd } from '../python-path';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PDF_TO_IMAGES = path.join(PROJECT_ROOT, 'scripts', 'pdf_to_images.py');
const MIN_TEXT_LENGTH = 100;

export async function parsePdf(filePath: string): Promise<ParseResult> {
  const start = Date.now();
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();

  const fullText = result.pages.map(p => p.text).join('\n');
  const pageCount = result.pages.length;

  // If text is too short, it's likely a scanned PDF — fall back to OCR
  if (fullText.trim().length < MIN_TEXT_LENGTH) {
    console.log(`[pdf] Low text (${fullText.trim().length} chars, ${pageCount} pages) — treating as scan, using OCR`);
    return await parseAsScan(filePath, pageCount, start);
  }

  return {
    text: fullText,
    pageCount,
    elapsedMs: Date.now() - start,
  };
}

async function parseAsScan(filePath: string, pageCount: number, startMs: number): Promise<ParseResult> {
  const tmpDir = path.join(path.dirname(filePath), '.scan_' + path.basename(filePath));

  try {
    // Step 1: Convert PDF pages to images
    const imgResult = await new Promise<{ pages: number; images: string[] }>((resolve, reject) => {
      execFile(getPythonCmd(), [PDF_TO_IMAGES, filePath, tmpDir], {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120000,
        env: process.env,
      }, (err, stdout) => {
        if (err) {
          reject(new Error('PDF to images failed: ' + ((err as any).message || '')));
          return;
        }
        try {
          const data = JSON.parse(stdout);
          if (data.error) reject(new Error(data.error));
          else resolve(data);
        } catch {
          reject(new Error('PDF to images parse error'));
        }
      });
    });

    console.log(`[pdf] Converted ${imgResult.pages} pages to images`);

    // Step 2: OCR each image
    const engine = getOcrEngine();
    const texts: string[] = [];
    for (const imgPath of imgResult.images) {
      const ocrText = await engine.recognize(imgPath);
      texts.push(ocrText);
    }

    const fullText = texts.join('\n');
    return {
      text: fullText,
      pageCount,
      elapsedMs: Date.now() - startMs,
    };
  } finally {
    // Cleanup temp images
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
