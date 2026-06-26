import fs from 'fs';
import mammoth from 'mammoth';
import { ParseResult } from '../types';

export async function parseWord(filePath: string): Promise<ParseResult> {
  const start = Date.now();
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  if (result.messages.length > 0) {
    console.warn('Word parse warnings:', result.messages);
  }
  return { text: result.value, elapsedMs: Date.now() - start };
}
