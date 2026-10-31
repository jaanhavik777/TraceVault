"use client";
// Top navigation. OWNER: Jaanhavi (rendered from app/layout.tsx on every page except /login)
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { Me } from "./types";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (pathname === "/login") { setMe(null); return; }
    api<Me>("/api/auth/me").then(setMe).catch(() => setMe(null));
  }, [pathname]);

  if (pathname === "/login") return null;

  const links = [
    { href: "/incidents", label: "Incidents" },
    { href: "/search", label: "Search" },
    ...(me?.role === "ADMIN" ? [{ href: "/dashboard", label: "Dashboard" }, { href: "/admin", label: "Admin" }] : []),
  ];

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="nav">
      <strong>TraceVault</strong>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={pathname.startsWith(l.href) ? "active" : ""}>
          {l.label}
        </Link>
      ))}
      <span className="spacer" />
      {me && <span className="muted">{me.fullName} ({me.role.toLowerCase()})</span>}
      <button className="btn btn-blue btn-sm" onClick={logout}>Log out</button>
    </nav>
  );
}
