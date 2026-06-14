// Typed fetch wrapper for the FastAPI backend. Server-side only: it reads the
// access_token httpOnly cookie and forwards it as a Bearer token. Client
// components reach the API through server actions, never this module directly.

import { cookies } from "next/headers";

import type {
  Alert,
  Attendance,
  DashboardStats,
  HeatmapDay,
  Learner,
  LearnerDetail,
  Page,
  Programme,
  Provider,
  Site,
  SiteHeadcount,
  StipendBatch,
  StipendPreview,
  StipendSummary,
  User,
} from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

async function authHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get("access_token")?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function withParams(path: string, params?: Params): string {
  if (!params) return BASE + path;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") qs.append(key, String(value));
  }
  const query = qs.toString();
  return BASE + path + (query ? `?${query}` : "");
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) return data.detail.map((d: { msg?: string }) => d.msg).join(", ");
    return JSON.stringify(data);
  } catch {
    return res.statusText;
  }
}

async function request<T>(
  method: string,
  path: string,
  opts: { params?: Params; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(withParams(path, opts.params), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function requestText(method: string, path: string): Promise<string> {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(await authHeaders()) },
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return res.text();
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export const api = {
  base: BASE,
  auth: {
    // No auth header — used before a session exists.
    async login(username: string, password: string): Promise<LoginResponse> {
      const res = await fetch(`${BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
      });
      if (!res.ok) throw new ApiError(res.status, await parseError(res));
      return res.json();
    },
    me: () => request<User>("GET", "/api/v1/auth/me"),
  },
  learners: {
    list: (params?: Params) => request<Page<Learner>>("GET", "/api/v1/learners", { params }),
    get: (id: number) => request<LearnerDetail>("GET", `/api/v1/learners/${id}`),
    create: (body: unknown) => request<LearnerDetail>("POST", "/api/v1/learners", { body }),
    update: (id: number, body: unknown) => request<LearnerDetail>("PUT", `/api/v1/learners/${id}`, { body }),
    setStatus: (id: number, status: string) =>
      request<Learner>("PATCH", `/api/v1/learners/${id}/status`, { body: { status } }),
    remove: (id: number) => request<{ detail: string }>("DELETE", `/api/v1/learners/${id}`),
  },
  attendance: {
    list: (params?: Params) => request<Page<Attendance>>("GET", "/api/v1/attendance", { params }),
    checkIn: (body: unknown) => request<Attendance>("POST", "/api/v1/attendance/check-in", { body }),
    checkOut: (body: unknown) => request<Attendance>("POST", "/api/v1/attendance/check-out", { body }),
    update: (id: number, body: unknown) => request<Attendance>("PATCH", `/api/v1/attendance/${id}`, { body }),
    bulkVerify: (ids: number[], verification_status: string) =>
      request<{ updated: number }>("POST", "/api/v1/attendance/bulk-verify", {
        body: { ids, verification_status },
      }),
  },
  dashboard: {
    stats: () => request<DashboardStats>("GET", "/api/v1/dashboard/stats"),
    sites: () => request<SiteHeadcount[]>("GET", "/api/v1/dashboard/sites"),
    heatmap: (year: number, month: number) =>
      request<HeatmapDay[]>("GET", "/api/v1/dashboard/heatmap", { params: { year, month } }),
    alerts: () => request<Alert[]>("GET", "/api/v1/dashboard/alerts"),
  },
  stipends: {
    summary: () => request<StipendSummary>("GET", "/api/v1/stipends/summary"),
    preview: (params?: Params) => request<StipendPreview>("GET", "/api/v1/stipends/preview", { params }),
    list: () => request<StipendBatch[]>("GET", "/api/v1/stipends"),
    run: (body: unknown) => request<StipendBatch>("POST", "/api/v1/stipends/run", { body }),
    get: (id: number) => request<StipendBatch>("GET", `/api/v1/stipends/${id}`),
    confirm: (id: number) => request<StipendBatch>("POST", `/api/v1/stipends/${id}/confirm`),
    pay: (id: number) => request<StipendBatch>("POST", `/api/v1/stipends/${id}/pay`),
    csv: (id: number) => requestText("GET", `/api/v1/stipends/${id}/export.csv`),
  },
  sites: {
    list: () => request<Site[]>("GET", "/api/v1/sites"),
  },
  programmes: {
    list: () => request<Programme[]>("GET", "/api/v1/programmes"),
  },
  providers: {
    list: () => request<Provider[]>("GET", "/api/v1/providers"),
  },
};
