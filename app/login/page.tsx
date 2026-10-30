"use client";
// Login page. OWNER: Jaanhavi
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login failed");
        return;
      }
      router.push("/incidents");
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 380 }}>
      <h1>TraceVault</h1>
      <p className="muted">Sign in to investigate incidents.</p>
      <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: 12 }}>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                 style={{ width: "100%", padding: 8, marginTop: 4 }} autoComplete="username" />
        </label>
        <label>
          Password
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                 style={{ width: "100%", padding: 8, marginTop: 4 }} autoComplete="current-password" />
        </label>
        {error && <p role="alert" style={{ color: "#ff6b6b", margin: 0 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ padding: 10, cursor: "pointer" }}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
