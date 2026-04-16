import { useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AppNav } from "./AppNav";
import { SettingsPopup } from "../../shared/ui/SettingsPopup";
import { ExternalScheduleReviewDialog } from "../../shared/ui/ExternalScheduleReviewDialog";
import { AppContext } from "../../shared/hooks/useAppContext";
import { useExternalScheduleIntake } from "../../shared/hooks/useExternalScheduleIntake";
import { useMailWatchSync } from "../../shared/hooks/useMailWatchSync";
import { useScheduleAdvanceReminder } from "../../shared/hooks/useScheduleAdvanceReminder";
import { StartupSplash } from "../../features/onboarding/StartupSplash";
import {
  getThemeSetting,
  getResolvedTheme,
  hasCompletedOnboarding,
  type ThemeMode,
} from "../../shared/services/settingsService";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [settingsPopupOpen, setSettingsPopupOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [showStartupSplash, setShowStartupSplash] = useState(() => !hasCompletedOnboarding());
  const {
    open: externalScheduleReviewOpen,
    activeCandidate,
    pendingCount,
    confirming,
    dismissing,
    closeCandidateReview,
    reopenPendingReview,
    confirmCandidate,
    dismissCandidate,
  } = useExternalScheduleIntake();
  useMailWatchSync();
  useScheduleAdvanceReminder();

  useEffect(() => {
    getThemeSetting().then((theme) => {
      setThemeMode(theme);
      setResolvedTheme(getResolvedTheme(theme));
    });
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      getThemeSetting().then((theme) => {
        if (theme === "system") setResolvedTheme(e.matches ? "dark" : "light");
      });
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const handleSettingsClick = useCallback(() => {
    setSettingsPopupOpen(true);
  }, []);

  const handleThemeChange = useCallback((theme: ThemeMode) => {
    setThemeMode(theme);
    setResolvedTheme(getResolvedTheme(theme));
  }, []);

  return (
    <AppContext.Provider value={{ openSettings: handleSettingsClick }}>
      <div className={`app-shell ${resolvedTheme === "dark" ? "dark" : ""}`}>
        <AppNav
          onSettingsClick={handleSettingsClick}
          pendingScheduleCount={pendingCount}
          onPendingSchedulesClick={reopenPendingReview}
        />
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
          open={settingsPopupOpen}
          onClose={() => setSettingsPopupOpen(false)}
          themeMode={themeMode}
          onThemeChange={handleThemeChange}
        />
        <StartupSplash
          open={showStartupSplash}
          onComplete={() => setShowStartupSplash(false)}
        />
        <ExternalScheduleReviewDialog
          open={externalScheduleReviewOpen}
          candidate={activeCandidate}
          pendingCount={pendingCount}
          confirming={confirming}
          dismissing={dismissing}
          onClose={closeCandidateReview}
          onConfirm={confirmCandidate}
          onDismiss={dismissCandidate}
        />
      </div>
    </AppContext.Provider>
  );
}
