import { ResumeData } from '../types';

export function extractFields(rawText: string): ResumeData {
  const text = normalizeText(rawText);
  const phone = extractPhone(text);
  const email = extractEmail(text);
  const name = extractName(text);
  const education = extractEducation(text);
  const school = extractSchool(text);
  const skills = extractSkills(text);

  return {
    name,
    phone,
    email,
    gender: extractGender(text),
    birthYear: extractBirthYear(text),
    education,
    school,
    major: extractMajor(text),
    currentCompany: extractCurrentCompany(text),
    currentPosition: extractCurrentPosition(text),
    workYears: extractWorkYears(text),
    skills,
    workExperienceText: extractWorkExperience(text),
    educationText: extractEducationText(text),
    rawText: text,
    sourceFormat: 'pdf',
    confidence: calcConfidence({ phone, email, name, education }),
  };
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/\t/g, ' ').replace(/\u00A0/g, ' ')
    .replace(/\u200B/g, '').trim();
}

function extractPhone(text: string): string {
  // Remove spaces, dashes, dots before matching
  const cleaned = text.replace(/[\s\-\.]/g, '');
  const m = cleaned.match(/1[3-9]\d{9}/);
  return m ? m[0] : '';
}

function extractEmail(text: string): string {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}

function extractName(text: string): string {
  const noise = ['简历', '个人', '应聘', '求职', '联系', '邮箱', '电话', '地址', '性别'];
  const lines = text.split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (t.length < 2 || t.length > 4) continue;
    if (!/^[\u4e00-\u9fa5\u00b7]+$/.test(t)) continue;
    if (noise.some(w => t.includes(w))) continue;
    return t;
  }
  return '';
}

function extractGender(text: string): string {
  const head = text.substring(0, 200);
  if (/[男\u2642]/.test(head)) return '男';
  if (/[女\u2640]/.test(head)) return '女';
  return '';
}

function extractBirthYear(text: string): string {
  const m1 = text.match(/(?:出生|生日)[：:\s]*(\d{4})/);
  if (m1) return m1[1];
  const m2 = text.substring(0, 200).match(/\d{6}(19|20)\d{2}/);
  if (m2) return m2[0].substring(6, 10);
  return '';
}

function extractEducation(text: string): string {
  const levels = ['博士', '硕士', 'MBA', 'EMBA', '本科', '学士', '大专', '专科', '高中'];
  for (const l of levels) { if (text.includes(l)) return l; }
  return '';
}

function extractSchool(text: string): string {
  const m = text.match(/([^\s,]{2,20}(?:大学|学院))/);
  return m ? m[1] : '';
}

function extractMajor(text: string): string {
  const m = text.match(/(?:专业|主修)[：:\s]*([^\n]{2,20})/);
  return m ? m[1].trim() : '';
}

function extractSkills(text: string): string[] {
  const keywords = [
    'Java', 'Python', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'C++', 'C#',
    'React', 'Vue', 'Angular', 'Node.js', 'Spring', 'Django',
    'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch',
    'Docker', 'Kubernetes', 'AWS', 'Azure', 'Linux', 'Git',
    '机器学习', '深度学习', 'NLP', '数据分析',
    'Figma', 'Sketch', 'Photoshop', 'UI设计',
    '项目管理', '敏捷开发', 'Scrum',
  ];
  const lower = text.toLowerCase();
  return keywords.filter(k => lower.includes(k.toLowerCase()));
}

function extractCurrentCompany(text: string): string {
  const m = text.match(/([^\n]{3,30})\s*[-–—至到]\s*(?:至今|现在|Present)/);
  return m ? m[1].trim().replace(/^[·•\-]+/, '').trim() : '';
}

function extractCurrentPosition(text: string): string {
  const m = text.match(/(?:职位|岗位|职务)[：:\s]*([^\n]{2,20})/);
  return m ? m[1].trim() : '';
}

function extractWorkYears(text: string): string {
  const m = text.match(/(\d+)\s*年(?:工作|从业|相关)?经验/);
  return m ? m[1] + '年' : '';
}

function extractWorkExperience(text: string): string {
  const kw = ['工作经历', '工作经验', '工作履历', '职业经历', 'Work Experience'];
  const idx = findSection(text, kw);
  if (idx < 0) return '';
  const endKw = ['教育经历', '教育背景', '项目经历', '技能', '自我评价', '证书'];
  const endIdx = findNextSection(text, idx + 1, endKw);
  return endIdx > 0 ? text.substring(idx, endIdx).trim() : text.substring(idx).trim();
}

function extractEducationText(text: string): string {
  const kw = ['教育经历', '教育背景', '学习经历', 'Education'];
  const idx = findSection(text, kw);
  if (idx < 0) return '';
  const endKw = ['工作经历', '项目经历', '技能', '自我评价', '证书'];
  const endIdx = findNextSection(text, idx + 1, endKw);
  return endIdx > 0 ? text.substring(idx, endIdx).trim() : text.substring(idx).trim();
}

function findSection(text: string, keywords: string[]): number {
  for (const kw of keywords) {
    const idx = text.indexOf(kw);
    if (idx >= 0) return idx;
  }
  return -1;
}

function findNextSection(text: string, from: number, keywords: string[]): number {
  let min = text.length;
  for (const kw of keywords) {
    const idx = text.indexOf(kw, from);
    if (idx >= 0 && idx < min) min = idx;
  }
  return min < text.length ? min : -1;
}

function calcConfidence(f: { phone: string; email: string; name: string; education: string }): number {
  let score = 0;
  if (f.phone) score += 0.3;
  if (f.email) score += 0.2;
  if (f.name) score += 0.25;
  if (f.education) score += 0.15;
  return Math.min(score, 1);
}
