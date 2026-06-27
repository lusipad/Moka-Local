/**
 * Moka API 客户端
 * 支持真实 API 和 Mock 模式切换
 *
 * 环境变量:
 *   MOKA_BASE_URL  — Moka API 地址 (不设置则使用 Mock)
 *   MOKA_API_KEY   — Moka API Key
 *   MOKA_CLIENT_SECRET — Moka Client Secret
 *
 * Mock 模式: 使用本地 mock-moka.ts (端口 3002)
 */

const MOCK_BASE = 'http://localhost:3002';

interface MokaConfig {
  baseUrl: string;
  apiKey?: string;
  clientSecret?: string;
  mode: 'real' | 'mock';
}

function getConfig(): MokaConfig {
  const baseUrl = process.env.MOKA_BASE_URL;
  const apiKey = process.env.MOKA_API_KEY;
  const clientSecret = process.env.MOKA_CLIENT_SECRET;

  if (baseUrl && apiKey && clientSecret) {
    return { baseUrl, apiKey, clientSecret, mode: 'real' };
  }
  return { baseUrl: MOCK_BASE, mode: 'mock' };
}

let cachedToken: string | null = null;
let tokenExpires = 0;

async function getToken(): Promise<string> {
  const config = getConfig();

  if (config.mode === 'mock') {
    const resp = await fetch(config.baseUrl + '/api/auth/token', { method: 'POST' });
    const data = await resp.json() as any;
    return data.data.access_token;
  }

  // Real Moka OAuth2
  if (cachedToken && Date.now() < tokenExpires) return cachedToken;

  const resp = await fetch(config.baseUrl + '/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: config.apiKey,
      client_secret: config.clientSecret,
    }),
  });
  const data = await resp.json() as any;
  cachedToken = data.access_token;
  tokenExpires = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken!;
}

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
  };
}

export interface MokaPosition {
  id: number;
  name: string;
  department: string;
  status: string;
}

export async function getPositions(status?: string): Promise<MokaPosition[]> {
  const token = await getToken();
  const config = getConfig();
  const url = config.baseUrl + '/api/v2/positions' + (status ? '?status=' + status : '');
  const resp = await fetch(url, { headers: authHeaders(token) });
  const data = await resp.json() as any;
  return data.data || [];
}

export interface MokaCandidateInput {
  name: string;
  phone: string;
  email?: string;
  education?: string;
  school?: string;
}

export interface MokaCandidate {
  id: number;
  name: string;
  phone: string;
  email: string;
  education: string;
  school: string;
}

export async function createCandidate(input: MokaCandidateInput): Promise<MokaCandidate> {
  const token = await getToken();
  const config = getConfig();
  const resp = await fetch(config.baseUrl + '/api/v2/candidates', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  const data = await resp.json() as any;
  if (data.code !== 0) throw new Error(data.message || '创建候选人失败');
  return data.data;
}

export async function linkResume(candidateId: number, resumeUrl: string): Promise<void> {
  const token = await getToken();
  const config = getConfig();
  const resp = await fetch(config.baseUrl + '/api/v2/candidates/' + candidateId + '/resumes', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ resumeUrl }),
  });
  const data = await resp.json() as any;
  if (data.code !== 0) throw new Error(data.message || '关联简历失败');
}

export interface MokaApplication {
  id: number;
  candidateId: number;
  positionId: number;
  candidateName: string;
  positionName: string;
  status: string;
  createdAt: string;
}

export async function createApplication(candidateId: number, positionId: number): Promise<MokaApplication> {
  const token = await getToken();
  const config = getConfig();
  const resp = await fetch(config.baseUrl + '/api/v2/applications', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ candidateId, positionId }),
  });
  const data = await resp.json() as any;
  if (data.code !== 0) throw new Error(data.message || '创建投递失败');
  return data.data;
}

export async function getApplications(): Promise<MokaApplication[]> {
  const token = await getToken();
  const config = getConfig();
  const resp = await fetch(config.baseUrl + '/api/v2/applications', { headers: authHeaders(token) });
  const data = await resp.json() as any;
  return data.data || [];
}

/** 一键同步: 候选人 → 简历 → 投递 */
export async function syncResume(
  candidateInput: MokaCandidateInput,
  resumeUrl: string,
  positionId: number,
): Promise<{ candidate: MokaCandidate; application: MokaApplication }> {
  const candidate = await createCandidate(candidateInput);
  await linkResume(candidate.id, resumeUrl);
  const application = await createApplication(candidate.id, positionId);
  return { candidate, application };
}

export { getConfig };
