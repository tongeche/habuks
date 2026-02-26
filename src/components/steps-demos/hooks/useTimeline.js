import { useCallback, useEffect, useRef } from "react";

export default function useTimeline({
  steps = [],
  isActive = false,
  loop = true,
  resetOnStop = true,
  onStep,
}) {
  const timerRef = useRef(null);
  const stepIndexRef = useRef(0);
  const onStepRef = useRef(onStep);

  useEffect(() => {
    onStepRef.current = onStep;
  }, [onStep]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runStep = useCallback(
    (index) => {
      if (!steps.length) return;

      const safeIndex = ((index % steps.length) + steps.length) % steps.length;
      const currentStep = steps[safeIndex];
      stepIndexRef.current = safeIndex;
      onStepRef.current?.(currentStep, safeIndex);

      const duration = Math.max(16, Number(currentStep?.ms || 0));
      timerRef.current = setTimeout(() => {
        const nextIndex = safeIndex + 1;
        if (nextIndex >= steps.length) {
          if (!loop) {
            return;
          }
          runStep(0);
          return;
        }
        runStep(nextIndex);
      }, duration);
    },
    [steps, loop]
  );

  useEffect(() => {
    if (!steps.length) return undefined;

    if (!isActive) {
      clearTimer();
      if (resetOnStop) {
        stepIndexRef.current = 0;
      }
      return undefined;
    }

    runStep(stepIndexRef.current);
    return () => {
      clearTimer();
    };
  }, [steps, isActive, resetOnStop, runStep, clearTimer]);

  const restart = useCallback(() => {
    clearTimer();
    stepIndexRef.current = 0;
    if (isActive) {
      runStep(0);
    }
  }, [clearTimer, isActive, runStep]);

  return {
    restart,
    clear: clearTimer,
  };
}
