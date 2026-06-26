import fs from 'fs';
import { PDFParse } from 'pdf-parse';
import { ParseResult } from '../types';

export async function parsePdf(filePath: string): Promise<ParseResult> {
  const start = Date.now();
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  const fullText = result.pages.map(p => p.text).join('\n');
  return {
    text: fullText,
    pageCount: result.pages.length,
    elapsedMs: Date.now() - start,
  };
}
