import fs from 'fs';
import path from 'path';
import { ResumeData } from './types';

const DATA_FILE = path.join(__dirname, '..', 'data', 'resumes.json');

export function loadResumes(): ResumeData[] {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    console.error('[store] Failed to load resumes, starting fresh');
    return [];
  }
}

export function saveResumes(resumes: ResumeData[]): void {
  const dir = path.dirname(DATA_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(resumes, null, 2), 'utf-8');
}
