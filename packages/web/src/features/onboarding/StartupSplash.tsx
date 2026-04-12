import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Clock3, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import {
  getStoredSettings,
  setCompletedOnboarding,
  setDailySettings,
  type DailySettings,
} from "../../shared/services/settingsService";
import { CitySelector, TimeSelectField } from "../../shared/ui/SettingsFields";
import { isRoutineRangeValid } from "../../shared/utils/routineTime";

interface StartupSplashProps {
  open: boolean;
  onComplete?: () => void;
}

interface OnboardingStep {
  id: "city" | "routine";
  icon: LucideIcon;
  accent: string;
  titleKey: string;
  descriptionKey: string;
  effectKey: string;
  tips: [string, string];
}

const STEPS: OnboardingStep[] = [
  {
    id: "city",
    icon: MapPin,
    accent: "#3F56D6",
    titleKey: "onboarding.city.title",
    descriptionKey: "onboarding.city.description",
    effectKey: "onboarding.city.effect",
    tips: ["onboarding.city.tipPrimary", "onboarding.city.tipSecondary"],
  },
  {
    id: "routine",
    icon: Clock3,
    accent: "#E17A2D",
    titleKey: "onboarding.routine.title",
    descriptionKey: "onboarding.routine.description",
    effectKey: "onboarding.routine.effect",
    tips: ["onboarding.routine.tipPrimary", "onboarding.routine.tipSecondary"],
  },
];

function OnboardingTip({ title, body, accent }: { title: string; body: string; accent: string }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 12%, white) 0%, color-mix(in srgb, ${accent} 6%, transparent) 100%)`,
        border: `1px solid color-mix(in srgb, ${accent} 20%, var(--color-border))`,
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>
        Tips
      </p>
      <p className="mt-2 text-sm font-medium" style={{ color: "var(--color-text)" }}>
        {title}
      </p>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
        {body}
      </p>
    </div>
  );
}

export function StartupSplash({ open, onComplete }: StartupSplashProps) {
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);
  const [draftSettings, setDraftSettings] = useState<DailySettings>(() => getStoredSettings());
  const [isSaving, setIsSaving] = useState(false);

  const currentStep = STEPS[stepIndex];
  const Icon = currentStep.icon;
  const cityReady =
    Boolean(draftSettings.locationCity) &&
    draftSettings.locationLatitude !== null &&
    draftSettings.locationLongitude !== null;
  const routineReady = isRoutineRangeValid(draftSettings.routineStartTime, draftSettings.routineEndTime);
  const canProceed = stepIndex === 0 ? cityReady : routineReady;

  const previewTimes = useMemo(() => {
    return {
      start: draftSettings.routineStartTime,
      end: draftSettings.routineEndTime,
    };
  }, [draftSettings.routineEndTime, draftSettings.routineStartTime]);

  if (!open) {
    return null;
  }

  const handleChange = (patch: Partial<DailySettings>) => {
    setDraftSettings((current) => ({ ...current, ...patch }));
  };

  const handleNext = () => {
    if (!canProceed || stepIndex >= STEPS.length - 1) {
      return;
    }
    setStepIndex((current) => current + 1);
  };

  const handleFinish = async () => {
    if (!routineReady || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await setDailySettings(draftSettings);
      await setCompletedOnboarding(true);
      onComplete?.();
      window.location.reload();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--color-primary) 16%, transparent) 0%, transparent 32%), radial-gradient(circle at 78% 18%, rgba(225,122,45,0.16) 0%, transparent 24%), linear-gradient(180deg, color-mix(in srgb, var(--color-bg) 72%, white) 0%, var(--color-bg) 100%)",
        }}
      />

      <div className="absolute inset-0 overflow-hidden opacity-60">
        <div
          className="absolute -left-24 top-16 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "color-mix(in srgb, var(--color-primary) 16%, transparent)" }}
        />
        <div
          className="absolute right-0 top-0 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "rgba(225,122,45,0.18)" }}
        />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-10 py-10">
        <div
          className="grid w-full max-w-6xl grid-cols-[1.05fr_1fr] overflow-hidden rounded-[36px]"
          style={{
            border: "1px solid color-mix(in srgb, var(--color-border) 72%, white)",
            background: "color-mix(in srgb, var(--color-surface) 92%, white)",
            boxShadow: "0 28px 80px rgba(17,24,39,0.14)",
            backdropFilter: "blur(18px)",
          }}
        >
          <div className="relative overflow-hidden px-10 py-12">
            <div
              className="absolute right-[-72px] top-[-120px] h-64 w-64 rounded-full blur-3xl"
              style={{ background: "color-mix(in srgb, var(--color-primary) 14%, transparent)" }}
            />

            <div className="relative flex h-full flex-col justify-between">
              <div className="space-y-8">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2"
                  style={{
                    background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                    color: "var(--color-primary)",
                    border: "1px solid color-mix(in srgb, var(--color-primary) 16%, var(--color-border))",
                  }}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">
                    {t("onboarding.badge")}
                  </span>
                </div>

                <div className="space-y-4">
                  <h1
                    className="max-w-xl text-[42px] font-semibold leading-[1.04] tracking-[-0.04em]"
                    style={{ color: "var(--color-text)" }}
                  >
                    {t("onboarding.title")}
                  </h1>
                  <p className="max-w-lg text-[15px] leading-7" style={{ color: "var(--color-text-secondary)" }}>
                    {t("onboarding.subtitle")}
                  </p>
                </div>

                <div className="space-y-3">
                  {STEPS.map((step, index) => {
                    const StepIcon = step.icon;
                    const active = index === stepIndex;
                    const completed = index < stepIndex;

                    return (
                      <div
                        key={step.id}
                        className="flex items-center gap-4 rounded-2xl px-4 py-4 transition-all"
                        style={{
                          background: active
                            ? `linear-gradient(135deg, color-mix(in srgb, ${step.accent} 14%, white), color-mix(in srgb, ${step.accent} 5%, transparent))`
                            : "color-mix(in srgb, var(--color-surface) 72%, transparent)",
                          border: active
                            ? `1px solid color-mix(in srgb, ${step.accent} 22%, var(--color-border))`
                            : "1px solid transparent",
                          opacity: completed || active ? 1 : 0.62,
                        }}
                      >
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-2xl"
                          style={{
                            background: completed ? step.accent : `color-mix(in srgb, ${step.accent} 14%, white)`,
                            color: completed ? "#ffffff" : step.accent,
                          }}
                        >
                          {completed ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>
                            {t("onboarding.stepLabel", { step: index + 1 })}
                          </p>
                          <p className="mt-1 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                            {t(step.titleKey)}
                          </p>
                          <p className="mt-1 text-xs leading-5" style={{ color: "var(--color-text-secondary)" }}>
                            {t(step.effectKey)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                className="mt-10 rounded-[28px] p-5"
                style={{
                  background: "linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 84%, white), color-mix(in srgb, var(--color-border-light) 82%, transparent))",
                  border: "1px solid var(--color-border)",
                }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>
                  {t("onboarding.preview")}
                </p>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {t("settings.city")}
                    </p>
                    <p className="mt-1 text-base font-semibold" style={{ color: "var(--color-text)" }}>
                      {draftSettings.locationCity || t("onboarding.previewPending")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {t("settings.routineWindow")}
                    </p>
                    <p className="mt-1 text-base font-semibold tabular-nums" style={{ color: "var(--color-text)" }}>
                      {previewTimes.start} - {previewTimes.end}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="relative px-10 py-12"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 86%, white) 0%, color-mix(in srgb, var(--color-border-light) 64%, transparent) 100%)",
              borderLeft: "1px solid color-mix(in srgb, var(--color-border) 76%, white)",
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.id}
                initial={{ opacity: 0, x: 32, rotate: 1.4 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                exit={{ opacity: 0, x: -28, rotate: -1.4 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-full flex-col justify-between"
              >
                <div className="space-y-8">
                  <div className="flex items-start justify-between gap-6">
                    <div className="space-y-3">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-3xl"
                        style={{
                          background: `linear-gradient(135deg, color-mix(in srgb, ${currentStep.accent} 18%, white), color-mix(in srgb, ${currentStep.accent} 10%, transparent))`,
                          color: currentStep.accent,
                          boxShadow: `0 16px 28px color-mix(in srgb, ${currentStep.accent} 20%, transparent)`,
                        }}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: currentStep.accent }}>
                          {t("onboarding.stepLabel", { step: stepIndex + 1 })}
                        </p>
                        <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.03em]" style={{ color: "var(--color-text)" }}>
                          {t(currentStep.titleKey)}
                        </h2>
                        <p className="mt-3 max-w-xl text-sm leading-7" style={{ color: "var(--color-text-secondary)" }}>
                          {t(currentStep.descriptionKey)}
                        </p>
                      </div>
                    </div>

                    <div
                      className="rounded-2xl px-4 py-3 text-right"
                      style={{
                        background: "color-mix(in srgb, var(--color-surface) 75%, transparent)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-muted)" }}>
                        {t("onboarding.impact")}
                      </p>
                      <p className="mt-2 text-sm leading-6" style={{ color: "var(--color-text)" }}>
                        {t(currentStep.effectKey)}
                      </p>
                    </div>
                  </div>

                  {currentStep.id === "city" ? (
                    <div className="space-y-4">
                      <div
                        className="rounded-[28px] p-5"
                        style={{
                          background: "color-mix(in srgb, var(--color-surface) 84%, white)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        <p className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                          {t("settings.cityDesc")}
                        </p>
                        <div className="mt-4">
                          <CitySelector value={draftSettings} onChange={handleChange} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <OnboardingTip
                          title={t("onboarding.city.tipPrimaryTitle")}
                          body={t("onboarding.city.tipPrimary")}
                          accent={currentStep.accent}
                        />
                        <OnboardingTip
                          title={t("onboarding.city.tipSecondaryTitle")}
                          body={t("onboarding.city.tipSecondary")}
                          accent={currentStep.accent}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div
                        className="rounded-[28px] p-5"
                        style={{
                          background: "color-mix(in srgb, var(--color-surface) 84%, white)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
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
                          <p className="mt-3 text-xs" style={{ color: "var(--color-error)" }}>
                            {t("settings.routineValidation")}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <OnboardingTip
                          title={t("onboarding.routine.tipPrimaryTitle")}
                          body={t("onboarding.routine.tipPrimary")}
                          accent={currentStep.accent}
                        />
                        <OnboardingTip
                          title={t("onboarding.routine.tipSecondaryTitle")}
                          body={t("onboarding.routine.tipSecondary")}
                          accent={currentStep.accent}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-10 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
                    disabled={stepIndex === 0}
                    className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-opacity"
                    style={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                      opacity: stepIndex === 0 ? 0.45 : 1,
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t("onboarding.actions.back")}
                  </button>

                  {stepIndex < STEPS.length - 1 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={!canProceed}
                      className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-all"
                      style={{
                        background: canProceed
                          ? `linear-gradient(135deg, ${currentStep.accent}, color-mix(in srgb, ${currentStep.accent} 78%, black))`
                          : "var(--color-text-muted)",
                        boxShadow: canProceed
                          ? `0 18px 30px color-mix(in srgb, ${currentStep.accent} 24%, transparent)`
                          : "none",
                      }}
                    >
                      {t("onboarding.actions.next")}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { void handleFinish(); }}
                      disabled={!canProceed || isSaving}
                      className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-all"
                      style={{
                        background: canProceed && !isSaving
                          ? `linear-gradient(135deg, ${currentStep.accent}, color-mix(in srgb, ${currentStep.accent} 78%, black))`
                          : "var(--color-text-muted)",
                        boxShadow: canProceed && !isSaving
                          ? `0 18px 30px color-mix(in srgb, ${currentStep.accent} 24%, transparent)`
                          : "none",
                      }}
                    >
                      {isSaving ? t("settings.saving") : t("onboarding.actions.finish")}
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
