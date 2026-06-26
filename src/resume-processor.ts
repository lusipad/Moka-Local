import path from 'path';
import { ResumeData, ParseResult } from './types';
import { parsePdf } from './parsers/pdf-parser';
import { parseWord } from './parsers/word-parser';
import { parseImage } from './parsers/image-parser';
import { extractFields } from './extractors/field-extractor';

const FORMAT_MAP: Record<string, 'pdf' | 'word' | 'image'> = {
  '.pdf': 'pdf',
  '.docx': 'word',
  '.doc': 'word',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.bmp': 'image',
  '.tiff': 'image',
};

export async function processResume(filePath: string): Promise<ResumeData> {
  const ext = path.extname(filePath).toLowerCase();
  const format = FORMAT_MAP[ext];
  if (!format) {
    throw new Error(`Unsupported format: ${ext}`);
  }

  let parseResult: ParseResult;
  switch (format) {
    case 'pdf': parseResult = await parsePdf(filePath); break;
    case 'word': parseResult = await parseWord(filePath); break;
    case 'image': parseResult = await parseImage(filePath); break;
  }

  const resume = extractFields(parseResult.text);
  resume.sourceFormat = format;

  console.log(`Parsed resume (${format}, ${parseResult.elapsedMs}ms)`);
  console.log(`  name: ${resume.name || '?'}`);
  console.log(`  phone: ${resume.phone || '?'}`);
  console.log(`  email: ${resume.email || '?'}`);
  console.log(`  education: ${resume.education || '?'}`);
  console.log(`  skills: ${resume.skills.join(', ') || '?'}`);
  console.log(`  confidence: ${(resume.confidence * 100).toFixed(0)}%`);

  return resume;
}

export { parsePdf } from './parsers/pdf-parser';
export { parseWord } from './parsers/word-parser';
export { parseImage } from './parsers/image-parser';
export { extractFields } from './extractors/field-extractor';
