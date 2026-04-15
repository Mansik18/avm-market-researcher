export const API_BASE = "http://localhost:8000";

const TOKEN_KEY = "avm_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.detail)
        detail =
          typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {}
    throw new Error(detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------- types ----------

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Project {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ContextData {
  description: string;
  audience: string;
  geography: string;
  stage: string;
  price: string;
  paying_customers: number;
  big_job: string;
  pain_points: string[];
  current_solutions: string[];
  competitors_mentioned: string[];
  segment_hypotheses: string[];
  notes: string;
}

export interface ProjectContextOut {
  project_id: number;
  data: ContextData;
  completeness: number;
  ready_for_analysis: boolean;
  summary: string;
  has_report: boolean;
  last_report_at: string | null;
  updated_at: string;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface IntakeTurnOut {
  assistant_message: HistoryMessage;
  context: ProjectContextOut;
}

export interface Competitor {
  name: string;
  url: string;
  pricing: string;
  positioning: string;
  strengths: string[];
  weaknesses: string[];
  unmet_job: string;
}

export interface UnitEconomics {
  amppu: number;
  margin_pct: number;
  monthly_churn_pct: number;
  cac: number;
  ltv: number;
  ltv_cac: number;
  payback_months: number;
  health: "healthy" | "moderate" | "unhealthy";
}

export interface Segment {
  name: string;
  struggling_moment: string;
  core_job: string;
  emotional_job: string;
  social_job: string;
  switch_story: string;
  tam_reasoning: string;
  tam_usd: number;
  sam_usd: number;
  som_usd: number;
  unit_econ: UnitEconomics;
  score_job_fit: number;
  score_market_size: number;
  score_economics: number;
  score_moat: number;
  total_score: number;
  category: "A" | "B" | "C";
  unmet_jobs: string[];
  key_message: string;
  main_channel: string;
}

export interface Risk {
  assumption: string;
  probability: number;
  impact: number;
  score: number;
  experiment: string;
}

export interface AnalysisReport {
  verdict: "GO" | "GO_CONDITIONAL" | "PIVOT" | "NO_GO";
  verdict_condition: string;
  positioning: string;
  main_insight: string;
  asymmetric_opportunity: string;
  competitors: Competitor[];
  segments: Segment[];
  top_risks: Risk[];
  competitor_response: string;
  next_three_steps: string[];
  plan_90d: string[];
  created_at: string | null;
}

// ---------- api ----------

export const api = {
  register: (email: string, password: string) =>
    apiFetch<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    apiFetch<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => apiFetch<User>("/auth/me"),

  listProjects: () => apiFetch<Project[]>("/projects/"),
  createProject: (name: string) =>
    apiFetch<Project>("/projects/", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  deleteProject: (id: number) =>
    apiFetch<void>(`/projects/${id}`, { method: "DELETE" }),
  getContext: (id: number) =>
    apiFetch<ProjectContextOut>(`/projects/${id}/context`),
  getHistory: (id: number) =>
    apiFetch<{ messages: HistoryMessage[] }>(`/projects/${id}/history`),
  intakeTurn: (projectId: number, message: string) =>
    apiFetch<IntakeTurnOut>(`/projects/${projectId}/intake`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  analyze: (projectId: number) =>
    apiFetch<AnalysisReport>(`/projects/${projectId}/analyze`, {
      method: "POST",
    }),
  getReport: (projectId: number) =>
    apiFetch<AnalysisReport>(`/projects/${projectId}/report`),
};
