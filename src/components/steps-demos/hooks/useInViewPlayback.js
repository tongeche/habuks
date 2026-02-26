import { useEffect, useMemo, useRef, useState } from "react";

export default function useInViewPlayback({
  threshold = 0.35,
  rootMargin = "0px",
  mode = "pause-offscreen",
} = {}) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const element = ref.current;
    if (!element) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const visible = entry.isIntersecting;
          setIsInView(visible);
          if (visible) {
            setHasEntered(true);
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const shouldPlay = useMemo(() => {
    if (mode === "once") {
      return hasEntered;
    }
    if (mode === "while-visible" || mode === "pause-offscreen") {
      return isInView;
    }
    return isInView;
  }, [mode, hasEntered, isInView]);

  return {
    ref,
    isInView,
    hasEntered,
    shouldPlay,
  };
}
