"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { ChevronRight, ChevronLeft, X, Sparkles } from "lucide-react";
import { useTour } from "./TourContext";
import { TourPlacement } from "./tourSteps";

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const ProductTourOverlay: React.FC = () => {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    prevStep,
    skipTour,
  } = useTour();

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Find target element & update bounding rect
  const updateRect = useCallback(() => {
    if (!currentStep) return;

    const isMobile = window.innerWidth < 768;
    const selector = (isMobile && currentStep.mobileTargetSelector) || currentStep.targetSelector;

    let el: HTMLElement | null = null;
    try {
      el = document.querySelector<HTMLElement>(selector);
    } catch {
      el = null;
    }

    if (el) {
      setTargetElement(el);
      const rect = el.getBoundingClientRect();
      setTargetRect({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      });
    } else {
      setTargetElement(null);
      setTargetRect(null);
    }
  }, [currentStep]);

  // Continuously attempt finding target element when step changes
  useEffect(() => {
    if (!isActive || !currentStep) {
      setTargetRect(null);
      setTargetElement(null);
      return;
    }

    updateRect();

    // Poll for dynamic targets rendered asynchronously (up to 3 seconds)
    const interval = setInterval(updateRect, 150);
    const timeout = setTimeout(() => clearInterval(interval), 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isActive, currentStep, currentStepIndex, updateRect]);

  // Auto-scroll target into view
  useEffect(() => {
    if (targetElement && currentStep) {
      const isFixed =
        window.getComputedStyle(targetElement).position === "fixed" ||
        Boolean(targetElement.closest(".fixed"));
      if (!isFixed) {
        const placement = currentStep.placement || "bottom";
        const rect = targetElement.getBoundingClientRect();
        const headerEl = document.querySelector("header");
        const headerOffset = headerEl ? Math.max(65, headerEl.getBoundingClientRect().height) : 80;

        if (placement === "top") {
          // Scroll target toward bottom of viewport to leave space above
          const targetY = window.scrollY + rect.bottom - window.innerHeight + 24;
          window.scrollTo({
            top: Math.max(0, targetY),
            behavior: isReducedMotion ? "auto" : "smooth",
          });
        } else if (
          placement === "bottom" ||
          placement === "bottom-right" ||
          placement === "bottom-left"
        ) {
          // Scroll target below sticky header with 16px vertical clearance
          const targetY = window.scrollY + rect.top - headerOffset - 16;
          window.scrollTo({
            top: Math.max(0, targetY),
            behavior: isReducedMotion ? "auto" : "smooth",
          });
        } else {
          targetElement.scrollIntoView({
            behavior: isReducedMotion ? "auto" : "smooth",
            block: "center",
            inline: "nearest",
          });
        }
      }
      // Re-read rect after scroll completes
      const timer = setTimeout(updateRect, 350);
      return () => clearTimeout(timer);
    }
  }, [targetElement, currentStep, isReducedMotion, updateRect]);

  // Recalculate spotlight and popover on scroll and resize
  useEffect(() => {
    if (!isActive) return;

    const handleScrollOrResize = () => {
      updateRect();
    };

    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isActive, updateRect]);

  // Compute Popover Position
  useEffect(() => {
    if (!targetRect || !popoverRef.current) return;

    const vpWidth = window.innerWidth;
    const vpHeight = window.innerHeight;
    const popoverRect = popoverRef.current.getBoundingClientRect();
    const pWidth = popoverRect.width || 340;
    const pHeight = popoverRect.height || 160;

    const headerEl = document.querySelector("header");
    const headerHeight = headerEl ? Math.max(65, headerEl.getBoundingClientRect().height) : 75;

    let top = 0;
    let left = 0;

    if (vpWidth < 640) {
      // Mobile positioning: center horizontally, clamp safely inside viewport
      left = Math.max(12, Math.min(Math.max(12, vpWidth - pWidth - 12), (vpWidth - pWidth) / 2));

      const spaceBelow = vpHeight - targetRect.bottom;
      const spaceAbove = targetRect.top - headerHeight;

      if (spaceBelow >= pHeight + 16) {
        top = targetRect.bottom + 12;
      } else if (spaceAbove >= pHeight + 16) {
        top = targetRect.top - pHeight - 12;
      } else {
        // Fallback: pin near bottom with safe margin
        top = Math.max(headerHeight + 10, vpHeight - pHeight - 16);
      }
    } else {
      // Desktop / Tablet positioning based on step.placement
      const requestedPlacement = currentStep?.placement || "bottom";

      if (requestedPlacement === "bottom-right") {
        left = Math.max(16, vpWidth - pWidth - 24);
        top = Math.max(headerHeight + 10, vpHeight - pHeight - 24);
      } else if (requestedPlacement === "bottom-left") {
        left = 24;
        top = Math.max(headerHeight + 10, vpHeight - pHeight - 24);
      } else if (requestedPlacement === "top-right") {
        left = Math.max(16, vpWidth - pWidth - 24);
        top = headerHeight + 10;
      } else if (requestedPlacement === "top-left") {
        left = 24;
        top = headerHeight + 10;
      } else {
        // Directional placements with collision detection & auto-flip
        let placement: TourPlacement = requestedPlacement;

        const spaceAbove = targetRect.top - headerHeight;
        const spaceBelow = vpHeight - targetRect.bottom;
        const spaceLeft = targetRect.left;
        const spaceRight = vpWidth - targetRect.right;

        // Auto-flip vertical if needed
        if (placement === "top" && spaceAbove < pHeight + 14 && spaceBelow >= pHeight + 14) {
          placement = "bottom";
        } else if (placement === "bottom" && spaceBelow < pHeight + 14 && spaceAbove >= pHeight + 14) {
          placement = "top";
        }

        // Auto-flip horizontal if needed
        if (placement === "right" && spaceRight < pWidth + 14) {
          if (spaceLeft >= pWidth + 14) {
            placement = "left";
          } else if (spaceBelow >= pHeight + 14) {
            placement = "bottom";
          } else if (spaceAbove >= pHeight + 14) {
            placement = "top";
          } else {
            placement = "bottom-right";
          }
        } else if (placement === "left" && spaceLeft < pWidth + 14) {
          if (spaceRight >= pWidth + 14) {
            placement = "right";
          } else if (spaceBelow >= pHeight + 14) {
            placement = "bottom";
          } else {
            placement = "top";
          }
        }

        if (placement === "bottom-right") {
          left = Math.max(16, vpWidth - pWidth - 24);
          top = Math.max(headerHeight + 10, vpHeight - pHeight - 24);
        } else if (placement === "top") {
          top = targetRect.top - pHeight - 14;
          left = targetRect.left + targetRect.width / 2 - pWidth / 2;
        } else if (placement === "left") {
          left = targetRect.left - pWidth - 14;
          top = targetRect.top + targetRect.height / 2 - pHeight / 2;
        } else if (placement === "right") {
          left = targetRect.right + 14;
          top = Math.max(headerHeight + 10, targetRect.top + 16);
        } else {
          // Default "bottom"
          top = targetRect.bottom + 14;
          left = targetRect.left + targetRect.width / 2 - pWidth / 2;
        }
      }

      // Viewport clamping
      left = Math.max(16, Math.min(vpWidth - pWidth - 16, left));
      top = Math.max(headerHeight + 10, Math.min(vpHeight - pHeight - 16, top));
    }

    setPopoverPos({ top, left });
  }, [targetRect, currentStep]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skipTour();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevStep();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, nextStep, prevStep, skipTour]);

  if (!isActive || !currentStep) return null;

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;
  const nextLabel = currentStep.nextButtonLabel || (isLastStep ? "Finish Walkthrough" : "Next");

  return (
    <div
      role="region"
      aria-label="Interactive Product Walkthrough"
      className="fixed inset-0 z-[60] pointer-events-none select-none"
    >
      {/* 1. SVG Spotlight Mask */}
      {targetRect && (
        <svg
          data-testid="product-tour-spotlight"
          className="fixed inset-0 w-full h-full pointer-events-none z-[60] transition-all duration-300"
        >
          <defs>
            <mask id="revora-tour-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={Math.max(0, targetRect.left - 6)}
                y={Math.max(0, targetRect.top - 6)}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          {/* Darkened backdrop */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(10, 14, 26, 0.72)"
            mask="url(#revora-tour-mask)"
          />
          {/* Subtle luminous gold border highlight */}
          <rect
            x={Math.max(0, targetRect.left - 6)}
            y={Math.max(0, targetRect.top - 6)}
            width={targetRect.width + 12}
            height={targetRect.height + 12}
            rx="8"
            fill="none"
            stroke="#E8A33D"
            strokeWidth="2"
            strokeDasharray="4 4"
            className={isReducedMotion ? "" : "animate-pulse"}
          />
        </svg>
      )}

      {/* 2. Anchored Popover Card */}
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-popover-title"
        aria-describedby="tour-popover-desc"
        data-testid="product-tour-popover"
        style={{
          position: "fixed",
          top: `${popoverPos.top}px`,
          left: `${popoverPos.left}px`,
          maxWidth: "calc(100vw - 24px)",
          width: "350px",
        }}
        className="pointer-events-auto z-[70] bg-[#1B2140] border border-[#2A3362] rounded-xl shadow-2xl p-3.5 sm:p-4 flex flex-col gap-2.5 sm:gap-3 transition-all duration-200 animate-in fade-in zoom-in-95"
      >
        {/* Header: Step Counter, Badge, & Dismiss */}
        <div className="flex items-center justify-between gap-2 border-b border-[#2A3362]/80 pb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              data-testid="tour-step-counter"
              className="text-[11px] font-mono font-bold text-[#E8A33D] px-2 py-0.5 rounded bg-[#E8A33D]/10 border border-[#E8A33D]/30"
            >
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
            {currentStep.badge && (
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase font-bold tracking-wider ${currentStep.badge.className}`}
              >
                {currentStep.badge.text}
              </span>
            )}
          </div>

          <button
            onClick={skipTour}
            data-testid="tour-close-btn"
            aria-label="Exit product walkthrough"
            className="w-7 h-7 rounded-lg text-[#B4B9D2] hover:text-[#F2F0EA] bg-[#222950] hover:bg-[#28315E] border border-[#2A3362] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content: Title & Explanation */}
        <div className="space-y-1 min-w-0">
          <h3
            id="tour-popover-title"
            className="text-sm sm:text-base font-serif font-bold text-[#F2F0EA] tracking-tight leading-snug break-words"
          >
            {currentStep.title}
          </h3>
          <p
            id="tour-popover-desc"
            className="text-xs text-[#B4B9D2] leading-relaxed font-sans"
          >
            {currentStep.explanation}
          </p>
        </div>

        {/* Segmented Progress Bar */}
        <div className="w-full bg-[#141930] h-1 rounded-full overflow-hidden border border-[#2A3362]/60">
          <div
            className="bg-[#E8A33D] h-full transition-all duration-300"
            style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Footer Actions: Skip, Back, Next */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <button
            onClick={skipTour}
            data-testid="tour-skip-btn"
            className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-mono text-[#7E85A6] hover:text-[#F2F0EA] hover:bg-[#222950] transition-colors cursor-pointer"
          >
            Skip
          </button>

          <div className="flex items-center gap-1.5">
            {!isFirstStep && (
              <button
                onClick={prevStep}
                data-testid="tour-back-btn"
                className="min-h-[36px] inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-[#F2F0EA] bg-[#222950] hover:bg-[#28315E] border border-[#2A3362] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              onClick={nextStep}
              data-testid={isLastStep ? "tour-finish-btn" : "tour-next-btn"}
              className="min-h-[36px] inline-flex items-center justify-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#E8A33D] hover:bg-[#E8A33D]/90 text-[#12172B] shadow-sm transition-all cursor-pointer"
            >
              <span>{nextLabel}</span>
              {!isLastStep && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
