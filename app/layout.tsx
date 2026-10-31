import "./globals.css";
import type { ReactNode } from "react";
import NavBar from "@/components/incident/NavBar";

export const metadata = {
  title: "TraceVault",
  description: "Incident Causality and Resolution Intelligence Platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
