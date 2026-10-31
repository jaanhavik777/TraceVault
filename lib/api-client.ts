// Browser-side fetch helper. OWNER: Jaanhavi (Kushi may use it too).
// Throws Error(message) using the API's { error } message; redirects to /login on 401.
export async function api<T = unknown>(
  url: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => null);

  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/login")) {
    window.location.href = "/login";
  }
  if (!res.ok) {
    const fields = data?.details
      ? " (" + Object.entries(data.details as Record<string, string[]>).map(([k, v]) => `${k}: ${v.join(", ")}`).join("; ") + ")"
      : "";
    throw new Error((data?.error ?? `Request failed (${res.status})`) + fields);
  }
  return data as T;
}
