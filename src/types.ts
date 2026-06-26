export interface ResumeData {
  name: string;
  phone: string;
  email: string;
  gender?: string;
  birthYear?: string;
  education?: string;
  school?: string;
  major?: string;
  currentCompany?: string;
  currentPosition?: string;
  workYears?: string;
  skills: string[];
  workExperienceText: string;
  educationText: string;
  rawText: string;
  sourceFormat: 'pdf' | 'word' | 'image';
  confidence: number;
}

export interface ParseResult {
  text: string;
  pageCount?: number;
  elapsedMs: number;
}
