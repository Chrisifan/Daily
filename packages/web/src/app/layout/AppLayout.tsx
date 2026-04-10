import { useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AppNav } from "./AppNav";
import { SettingsPopup } from "../../shared/ui/SettingsPopup";
import { useSettingsStore } from "../../shared/hooks/useSettingsStore";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const { themeMode, resolvedTheme, setTheme } = useSettingsStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className={`app-shell ${resolvedTheme === "dark" ? "dark" : ""}`}>
      <AppNav onSettingsClick={() => setSettingsOpen(true)} />
      <main className="app-main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <SettingsPopup
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        themeMode={themeMode}
        onThemeChange={setTheme}
      />
    </div>
  );
}