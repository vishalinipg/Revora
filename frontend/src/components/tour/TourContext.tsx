"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TOUR_STEPS, TourStep } from "./tourSteps";
import { ProductTourOverlay } from "./ProductTourOverlay";

const STORAGE_KEY = "revora_product_tour_completed";

export type ModalType = "timeline" | "outbox" | "benchmark" | null;

interface TourContextType {
  isActive: boolean;
  isCompleted: boolean;
  currentStepIndex: number;
  currentStep: TourStep | null;
  totalSteps: number;
  selectedPaymentId: string | null;
  activeModal: ModalType;
  startTour: (stepIndex?: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  finishTour: () => void;
  setSelectedPaymentId: (id: string | null) => void;
  setActiveModal: (modal: ModalType) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();

  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);

  // 1. Check local storage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") {
        setIsCompleted(true);
      } else if (typeof window !== "undefined" && window.location.search.includes("tour=1")) {
        // Explicit tour parameter requested
        const timer = setTimeout(() => {
          setIsActive(true);
          setCurrentStepIndex(0);
        }, 500);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore storage errors in restricted environments
    } finally {
      setHasCheckedStorage(true);
    }
  }, []);

  const currentStep = isActive && currentStepIndex >= 0 && currentStepIndex < TOUR_STEPS.length
    ? TOUR_STEPS[currentStepIndex]
    : null;

  // 2. Start tour
  const startTour = useCallback(
    (stepIndex = 0) => {
      const targetStep = TOUR_STEPS[stepIndex] || TOUR_STEPS[0];
      setCurrentStepIndex(stepIndex);
      setIsActive(true);
      setActiveModal(null);

      // Route if not already on the step's route
      if (targetStep.route === "/console/inspect" && selectedPaymentId) {
        if (!pathname?.startsWith("/console/inspect")) {
          router.push(`/console/inspect/${selectedPaymentId}`);
        }
      } else if (targetStep.route && pathname !== targetStep.route) {
        router.push(targetStep.route);
      }
    },
    [pathname, router, selectedPaymentId]
  );

  // 3. Skip tour
  const skipTour = useCallback(() => {
    setIsActive(false);
    setActiveModal(null);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
  }, []);

  // 4. Finish tour
  const finishTour = useCallback(() => {
    setIsActive(false);
    setIsCompleted(true);
    setActiveModal(null);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
  }, []);

  // 5. Advance to next step
  const nextStep = useCallback(() => {
    if (currentStepIndex >= TOUR_STEPS.length - 1) {
      finishTour();
      return;
    }

    const current = TOUR_STEPS[currentStepIndex];
    if (current?.closeModalBeforeNext) {
      setActiveModal(null);
    }

    const nextIndex = currentStepIndex + 1;
    const next = TOUR_STEPS[nextIndex];

    if (!next) {
      finishTour();
      return;
    }

    // Modal triggering
    if (next.modalToOpen) {
      setActiveModal(next.modalToOpen);
    } else {
      setActiveModal(null);
    }

    // Handle route transition if needed
    if (next.route === "/console/inspect") {
      let targetId = selectedPaymentId;
      if (!targetId && typeof document !== "undefined") {
        const inspectBtn = document.querySelector('[data-testid^="inspect-btn-"], [data-testid^="mobile-inspect-btn-"]');
        if (inspectBtn) {
          const testId = inspectBtn.getAttribute("data-testid") || "";
          targetId = testId.replace("mobile-inspect-btn-", "").replace("inspect-btn-", "");
        }
      }

      if (targetId) {
        if (!pathname?.includes(targetId)) {
          router.push(`/console/inspect/${targetId}`);
        }
      } else {
        console.warn("Product tour could not discover a valid real payment ID from the queue. Halting transition.");
        return;
      }
    } else if (next.route && pathname !== next.route) {
      router.push(next.route);
    }

    setCurrentStepIndex(nextIndex);
  }, [currentStepIndex, finishTour, pathname, router, selectedPaymentId]);

  // 6. Go back to previous step
  const prevStep = useCallback(() => {
    if (currentStepIndex <= 0) return;

    const prevIndex = currentStepIndex - 1;
    const prev = TOUR_STEPS[prevIndex];

    if (!prev) return;

    if (prev.modalToOpen) {
      setActiveModal(prev.modalToOpen);
    } else {
      setActiveModal(null);
    }

    // Handle route transition if needed
    if (prev.route === "/console/inspect") {
      let targetId = selectedPaymentId;
      if (!targetId && typeof document !== "undefined") {
        const inspectBtn = document.querySelector('[data-testid^="inspect-btn-"], [data-testid^="mobile-inspect-btn-"]');
        if (inspectBtn) {
          const testId = inspectBtn.getAttribute("data-testid") || "";
          targetId = testId.replace("mobile-inspect-btn-", "").replace("inspect-btn-", "");
        }
      }

      if (targetId) {
        if (!pathname?.includes(targetId)) {
          router.push(`/console/inspect/${targetId}`);
        }
      } else {
        return;
      }
    } else if (prev.route && pathname !== prev.route) {
      router.push(prev.route);
    }

    setCurrentStepIndex(prevIndex);
  }, [currentStepIndex, pathname, router, selectedPaymentId]);

  return (
    <TourContext.Provider
      value={{
        isActive,
        isCompleted,
        currentStepIndex,
        currentStep,
        totalSteps: TOUR_STEPS.length,
        selectedPaymentId,
        activeModal,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        finishTour,
        setSelectedPaymentId,
        setActiveModal,
      }}
    >
      {children}
      <ProductTourOverlay />
    </TourContext.Provider>
  );
};

export const useTour = (): TourContextType => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
};
