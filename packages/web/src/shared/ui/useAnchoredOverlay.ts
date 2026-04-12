import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";

type OverlaySide = "top" | "bottom";
type MatchTriggerWidth = "equal" | "min" | false;
type OverlayStrategy = "absolute" | "fixed";

interface UseAnchoredOverlayOptions {
  open: boolean;
  gap?: number;
  viewportPadding?: number;
  preferredSide?: OverlaySide;
  matchTriggerWidth?: MatchTriggerWidth;
  strategy?: OverlayStrategy;
}

interface UseAnchoredOverlayResult {
  anchorRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  side: OverlaySide;
  style: CSSProperties;
}

function getNextSide(
  preferredSide: OverlaySide,
  contentHeight: number,
  spaceAbove: number,
  spaceBelow: number,
) {
  const preferredSpace = preferredSide === "bottom" ? spaceBelow : spaceAbove;
  const oppositeSpace = preferredSide === "bottom" ? spaceAbove : spaceBelow;

  if (contentHeight <= preferredSpace) {
    return preferredSide;
  }

  if (oppositeSpace > preferredSpace) {
    return preferredSide === "bottom" ? "top" : "bottom";
  }

  return preferredSide;
}

export function useAnchoredOverlay({
  open,
  gap = 8,
  viewportPadding = 12,
  preferredSide = "bottom",
  matchTriggerWidth = "equal",
  strategy = "absolute",
}: UseAnchoredOverlayOptions): UseAnchoredOverlayResult {
  const anchorRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const [side, setSide] = useState<OverlaySide>(preferredSide);
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) {
      setSide(preferredSide);
      setStyle({});
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      const content = contentRef.current;

      if (!anchor || !content) {
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const spaceAbove = Math.max(anchorRect.top - viewportPadding, 0);
      const spaceBelow = Math.max(viewportHeight - anchorRect.bottom - viewportPadding, 0);
      const contentHeight = content.scrollHeight || content.getBoundingClientRect().height;
      const contentWidth = content.scrollWidth || content.getBoundingClientRect().width;
      const nextSide = getNextSide(preferredSide, contentHeight + gap, spaceAbove, spaceBelow);
      const availableHeight = Math.max(
        Math.floor(nextSide === "bottom" ? spaceBelow : spaceAbove),
        0,
      );
      const width =
        matchTriggerWidth === "equal"
          ? anchorRect.width
          : matchTriggerWidth === "min"
            ? Math.max(anchorRect.width, contentWidth)
            : contentWidth;
      const left = Math.min(
        Math.max(anchorRect.left, viewportPadding),
        Math.max(viewportWidth - width - viewportPadding, viewportPadding),
      );

      setSide(nextSide);
      setStyle({
        ...(matchTriggerWidth === "equal"
          ? { width: `${anchorRect.width}px` }
          : matchTriggerWidth === "min"
            ? { minWidth: `${anchorRect.width}px` }
            : {}),
        maxHeight: `${availableHeight}px`,
        ...(strategy === "fixed"
          ? {
              position: "fixed",
              left: `${left}px`,
              top: nextSide === "bottom" ? `${anchorRect.bottom + gap}px` : undefined,
              bottom: nextSide === "top" ? `${viewportHeight - anchorRect.top + gap}px` : undefined,
            }
          : {
              top: nextSide === "bottom" ? `calc(100% + ${gap}px)` : undefined,
              bottom: nextSide === "top" ? `calc(100% + ${gap}px)` : undefined,
            }),
      });
    };

    updatePosition();

    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();
    const resizeObserver = new ResizeObserver(() => updatePosition());

    if (anchorRef.current) {
      resizeObserver.observe(anchorRef.current);
    }

    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    window.visualViewport?.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("scroll", handleScroll);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("scroll", handleScroll);
    };
  }, [gap, matchTriggerWidth, open, preferredSide, strategy, viewportPadding]);

  return { anchorRef, contentRef, side, style };
}
