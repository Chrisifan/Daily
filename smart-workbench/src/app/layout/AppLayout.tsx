import type { ReactNode } from "react";
import { AppNav } from "./AppNav";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main">
        {children}
      </main>
    </div>
  );
}
