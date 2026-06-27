/**
 * AI 提取器接口 — 预留 LLM 接入能力
 *
 * 环境变量:
 *   AI_EXTRACTOR=rule|openai|custom     (默认 rule)
 *   AI_API_URL=http://...               (custom 模式端点)
 *   AI_API_KEY=sk-...                   (API Key)
 *   AI_MODEL=gpt-4o                     (模型名)
 */
import { ResumeData } from '../types';
import { extractFields } from '../extractors/field-extractor';

export interface AiExtractor {
  name: string;
  extract(rawText: string, sourceFormat: string): Promise<ResumeData>;
}

// Rule-based (default)
const ruleExtractor: AiExtractor = {
  name: 'rule',
  async extract(rawText: string, sourceFormat: string): Promise<ResumeData> {
    const result = extractFields(rawText);
    result.sourceFormat = sourceFormat as ResumeData['sourceFormat'];
    return result;
  },
};

// OpenAI / compatible API
const openaiExtractor: AiExtractor = {
  name: 'openai',
  async extract(rawText: string, sourceFormat: string): Promise<ResumeData> {
    const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('AI_API_KEY or OPENAI_API_KEY not set');
    const model = process.env.AI_MODEL || 'gpt-4o';
    const baseUrl = process.env.AI_API_URL || 'https://api.openai.com/v1';
    const truncated = rawText.substring(0, 6000);
    const resp = await fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'system',
          content: 'You are a resume parser. Extract structured fields from resume text. Return ONLY valid JSON, no markdown, no extra text. Use empty string for missing fields.',
        }, {
          role: 'user',
          content: 'Extract from this resume. Return strict JSON:\n' +
            '{"name":"","phone":"","email":"","gender":"","birthYear":"","education":"","school":"","major":"","currentCompany":"","currentPosition":"","workYears":"","skills":[],"workExperienceText":"","educationText":""}\n\n' +
            truncated,
        }],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });
    const data = await resp.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    let jsonStr = content.trim();
    const codeMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) jsonStr = codeMatch[1].trim();
    try {
      const parsed = JSON.parse(jsonStr);
      return {
        ...parsed,
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        rawText,
        sourceFormat: sourceFormat as ResumeData['sourceFormat'],
        confidence: 0.95,
        workExperienceText: parsed.workExperienceText || '',
        educationText: parsed.educationText || '',
      };
    } catch {
      console.warn('[ai] OpenAI parse failed, falling back to rule');
      return ruleExtractor.extract(rawText, sourceFormat);
    }
  },
};

// Custom HTTP endpoint
const customExtractor: AiExtractor = {
  name: 'custom',
  async extract(rawText: string, sourceFormat: string): Promise<ResumeData> {
    const url = process.env.AI_API_URL;
    if (!url) throw new Error('AI_API_URL not set');
    const apiKey = process.env.AI_API_KEY || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
    const resp = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ text: rawText, sourceFormat, raw_text: rawText }),
    });
    const data = await resp.json() as any;
    const result = data.result || data.data || data;
    return {
      ...result,
      skills: Array.isArray(result.skills) ? result.skills : [],
      rawText,
      sourceFormat: sourceFormat as ResumeData['sourceFormat'],
      confidence: result.confidence || 0.9,
      workExperienceText: result.workExperienceText || '',
      educationText: result.educationText || '',
    };
  },
};

const EXTRACTORS: Record<string, AiExtractor> = {
  rule: ruleExtractor,
  openai: openaiExtractor,
  custom: customExtractor,
};

let _extractor: AiExtractor | null = null;

export function getAiExtractor(): AiExtractor {
  if (_extractor) return _extractor;
  const name = (process.env.AI_EXTRACTOR || 'rule').toLowerCase();
  _extractor = EXTRACTORS[name] || ruleExtractor;
  if (!EXTRACTORS[name]) console.warn('[ai] Unknown extractor "' + name + '", fallback to rule');
  console.log('[ai] Using extractor: ' + _extractor.name);
  return _extractor;
}

export function registerExtractor(name: string, extractor: AiExtractor): void {
  EXTRACTORS[name] = extractor;
  _extractor = null;
  console.log('[ai] Registered extractor: ' + name);
}

export { EXTRACTORS };
