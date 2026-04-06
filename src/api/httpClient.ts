/** Base URL for Nest API (no trailing slash). */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  const base = (raw ?? "http://localhost:3000").replace(/\/$/, "");
  return base;
}

export async function apiGet<T>(path: string): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    credentials: "omit",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}
