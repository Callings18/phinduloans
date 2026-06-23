import { supabase } from "@phinduloans/shared/integrations/supabase/client";

/** Base URL for API (no trailing slash). Default matches apps/api-next dev port. */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  const base = (raw ?? "http://localhost:3001").replace(/\/$/, "");
  return base;
}

async function buildHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function apiGet<T>(path: string): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: await buildHeaders(),
    credentials: "omit",
  });
  if (!res.ok) {
    const text = await res.text();
    throw parseApiError(res.status, text, res.statusText);
  }
  return res.json() as Promise<T>;
}

function parseApiError(status: number, body: string, statusText: string): Error {
  try {
    const j = JSON.parse(body) as { error?: { message?: string; code?: string }; message?: string };
    const msg = j.error?.message ?? j.message ?? j.error?.code ?? body;
    return new Error(`API ${status}: ${msg}`);
  } catch {
    return new Error(`API ${status}: ${body || statusText}`);
  }
}

export async function apiPost<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await buildHeaders()),
      ...(init?.headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "omit",
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw parseApiError(res.status, text, res.statusText);
  }
  return res.json() as Promise<T>;
}
