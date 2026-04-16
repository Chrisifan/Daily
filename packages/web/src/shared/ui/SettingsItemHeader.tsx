import { useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import type { Ref } from "react";
import { useAnchoredOverlay } from "./useAnchoredOverlay";

interface SettingsItemHeaderProps {
  label: string;
  description?: string;
}

export function SettingsItemHeader({ label, description }: SettingsItemHeaderProps) {
  const tooltip = description?.trim();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = Boolean(tooltip) && (hovered || focused);
  const { anchorRef, contentRef, style } = useAnchoredOverlay({
    open,
    gap: 8,
    viewportPadding: 16,
    preferredSide: "top",
    matchTriggerWidth: false,
    strategy: "fixed",
  });

  return (
    <div className="settings-item-header">
      <p className="settings-item-header__label">
        {label}
      </p>
      {tooltip ? (
        <button
          ref={anchorRef as Ref<HTMLButtonElement>}
          type="button"
          className="settings-item-header__tooltip-trigger"
          aria-label={`显示“${label}”说明`}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {open && typeof document !== "undefined" && tooltip
        ? createPortal(
            <div
              ref={contentRef as Ref<HTMLDivElement>}
              className="settings-item-header__tooltip"
              role="tooltip"
              style={style}
            >
              {tooltip}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
