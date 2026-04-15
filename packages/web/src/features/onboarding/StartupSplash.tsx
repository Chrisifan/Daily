import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getStoredSettings,
  setCompletedOnboarding,
  setDailySettings,
  type DailySettings,
} from "../../shared/services/settingsService";
import { CitySelector, TimeSelectField } from "../../shared/ui/SettingsFields";
import { queueToastAfterReload, useToast } from "../../shared/ui/ToastProvider";
import { isRoutineRangeValid } from "../../shared/utils/routineTime";

interface StartupSplashProps {
  open: boolean;
  onComplete?: () => void;
}

export function StartupSplash({ open, onComplete }: StartupSplashProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [draftSettings, setDraftSettings] = useState<DailySettings>(() => getStoredSettings());
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const cityReady =
    Boolean(draftSettings.locationCity) &&
    draftSettings.locationLatitude !== null &&
    draftSettings.locationLongitude !== null;
  const routineReady = isRoutineRangeValid(draftSettings.routineStartTime, draftSettings.routineEndTime);
  const isCityStep = stepIndex === 0;
  const canProceed = isCityStep ? cityReady : routineReady;
  const canFinish = cityReady && routineReady;
  const stepKey = isCityStep ? "city" : "routine";
  const steps = [
    { id: "city", label: t("onboarding.city.title") },
    { id: "routine", label: t("onboarding.routine.title") },
  ];

  if (!open) {
    return null;
  }

  const handleChange = (patch: Partial<DailySettings>) => {
    setDraftSettings((current) => ({ ...current, ...patch }));
  };

  const handleNext = () => {
    if (!cityReady || stepIndex >= 1) {
      return;
    }
    setDirection(1);
    setStepIndex(1);
  };

  const handleBack = () => {
    if (stepIndex <= 0) {
      return;
    }
    setDirection(-1);
    setStepIndex(0);
  };

  const handleFinish = async () => {
    if (!canFinish || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await setDailySettings(draftSettings);
      await setCompletedOnboarding(true);
      queueToastAfterReload({ tone: "success", title: t("feedback.onboardingCompleted") });
      onComplete?.();
      window.location.reload();
    } catch (error) {
      console.error("Failed to finish onboarding:", error);
      toast.error(t("feedback.onboardingCompleteFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[90]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--color-bg) 82%, white) 0%, var(--color-bg) 100%)",
        }}
      />

      <div className="relative flex h-full items-center justify-center px-6 py-8">
        <div className="w-full max-w-[440px] px-2">
          <div className="space-y-3">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--color-text-muted)" }}
            >
              {t("onboarding.title")}
            </p>

            <div className="flex items-center gap-3">
              {steps.map((step, index) => {
                const active = index === stepIndex;
                const completed = index < stepIndex;

                return (
                  <div key={step.id} className="flex min-w-0 items-center gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold"
                        style={{
                          background: active || completed
                            ? "var(--color-primary)"
                            : "color-mix(in srgb, var(--color-border) 88%, white)",
                          color: active || completed ? "#fff" : "var(--color-text-muted)",
                        }}
                      >
                        {index + 1}
                      </span>
                      <span
                        className="truncate text-xs font-medium"
                        style={{
                          color: active ? "var(--color-text)" : "var(--color-text-muted)",
                        }}
                      >
                        {step.label}
                      </span>
                    </div>

                    {index < steps.length - 1 && (
                      <span
                        className="h-px w-8 shrink-0"
                        style={{
                          background: completed
                            ? "color-mix(in srgb, var(--color-primary) 50%, var(--color-border))"
                            : "var(--color-border)",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative mt-6 min-h-[172px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={stepKey}
                custom={direction}
                initial={{ opacity: 0, x: direction > 0 ? 28 : -28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction > 0 ? -20 : 20 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0"
              >
                <div className="min-h-[74px] space-y-2">
                  <h1
                    className="text-[28px] font-semibold tracking-[-0.05em]"
                    style={{ color: "var(--color-text)" }}
                  >
                    {isCityStep ? t("onboarding.city.title") : t("onboarding.routine.title")}
                  </h1>
                  <p className="text-sm leading-6 whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
                    {isCityStep ? t("onboarding.city.description") : t("onboarding.routine.description")}
                  </p>
                </div>

                <div className="mt-5 min-h-[88px]">
                  {isCityStep ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-muted)" }}>
                        {t("settings.city")}
                      </p>
                      <CitySelector value={draftSettings} onChange={handleChange} />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-muted)" }}>
                            {t("settings.routineStart")}
                          </p>
                          <TimeSelectField
                            value={draftSettings.routineStartTime}
                            onChange={(value) => handleChange({ routineStartTime: value })}
                            displayFormat={draftSettings.timeFormat}
                          />
                        </div>

                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-muted)" }}>
                            {t("settings.routineEnd")}
                          </p>
                          <TimeSelectField
                            value={draftSettings.routineEndTime}
                            onChange={(value) => handleChange({ routineEndTime: value })}
                            displayFormat={draftSettings.timeFormat}
                            treatMidnightAsEndOfDay
                          />
                        </div>
                      </div>

                      {!routineReady && (
                        <p className="text-xs" style={{ color: "var(--color-error)" }}>
                          {t("settings.routineValidation")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-6 flex items-center justify-end gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={stepIndex === 0}
                aria-label={t("onboarding.actions.back")}
                className="flex h-8 w-8 items-center justify-center transition-opacity"
                style={{
                  color: "var(--color-text-secondary)",
                  opacity: stepIndex === 0 ? 0 : 1,
                  pointerEvents: stepIndex === 0 ? "none" : "auto",
                }}
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
              </button>

              {isCityStep ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed}
                  aria-label={t("onboarding.actions.next")}
                  className="flex h-8 w-8 items-center justify-center transition-opacity"
                  style={{
                    color: canProceed ? "var(--color-primary)" : "var(--color-text-muted)",
                    opacity: canProceed ? 1 : 0.72,
                  }}
                >
                  <ArrowRight className="h-5 w-5" strokeWidth={2.2} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void handleFinish();
                  }}
                  disabled={!canFinish || isSaving}
                  aria-label={t("onboarding.actions.finish")}
                  className="text-sm font-semibold transition-opacity"
                  style={{
                    color: canFinish && !isSaving ? "var(--color-primary)" : "var(--color-text-muted)",
                    opacity: canFinish && !isSaving ? 1 : 0.72,
                  }}
                >
                  {isSaving ? t("settings.saving") : t("onboarding.actions.finish")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
