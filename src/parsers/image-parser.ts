import { execFile } from 'child_process';
import path from 'path';
import { ParseResult } from '../types';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const OCR_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'ocr.py');

export async function parseImage(filePath: string): Promise<ParseResult> {
  const start = Date.now();

  const result = await new Promise<{ text: string; lines: Array<{ text: string; confidence: number }> }>(
    (resolve, reject) => {
      execFile(
        'python',
        [OCR_SCRIPT, filePath],
        { maxBuffer: 50 * 1024 * 1024, timeout: 180000, encoding: 'buffer', env: { ...process.env, PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True' } },
        (err, stdoutBuf, stderrBuf) => {
          const stdout = stdoutBuf ? stdoutBuf.toString('utf-8') : '';
          const stderr = stderrBuf ? stderrBuf.toString('utf-8') : '';

          if (err && !stdout) {
            reject(new Error('PaddleOCR failed (exit ' + ((err as any).code || '?') + '): ' + (stderr || (err as any).message || '').trim()));
            return;
          }

          const jsonLine = stdout.trim().split('\n').pop() || stdout;
          try {
            const data = JSON.parse(jsonLine);
            if (data.error) {
              reject(new Error(data.error));
              return;
            }
            resolve(data);
          } catch {
            reject(new Error('PaddleOCR parse error: ' + stdout.substring(0, 200)));
          }
        }
      );
    }
  );

  return {
    text: result.text,
    elapsedMs: Date.now() - start,
  };
}
