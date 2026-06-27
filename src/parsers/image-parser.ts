import { getOcrEngine } from '../ocr';
import { ParseResult } from '../types';

export async function parseImage(filePath: string): Promise<ParseResult> {
  const start = Date.now();
  const engine = getOcrEngine();

  const text = await engine.recognize(filePath);

  return {
    text,
    elapsedMs: Date.now() - start,
  };
}
