import { useCallback, useEffect, useMemo, useState } from "react";

const INSTALL_BANNER_DISMISSED_AT_KEY = "habuks-install-banner-dismissed-at";
const INSTALL_VISIT_COUNT_KEY = "habuks-install-visit-count";
const INSTALL_SESSION_VISIT_KEY = "habuks-install-session-visit";
const DAY_MS = 24 * 60 * 60 * 1000;

const readStorageNumber = (storage, key, fallback = 0) => {
  if (!storage) return fallback;
  const rawValue = storage.getItem(key);
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const isStandaloneMode = () => {
  if (typeof window === "undefined") return false;
  const standaloneMatch = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = window.navigator?.standalone === true;
  return Boolean(standaloneMatch || iosStandalone);
};

const resolvePlatformDetails = () => {
  if (typeof window === "undefined") {
    return { isIosSafari: false, isAndroid: false };
  }
  const userAgent = String(window.navigator?.userAgent || "").toLowerCase();
  const platform = String(window.navigator?.platform || "");
  const touchPoints = Number(window.navigator?.maxTouchPoints || 0);
  const isIos =
    /iphone|ipad|ipod/.test(userAgent) || (platform === "MacIntel" && touchPoints > 1);
  const isSafari =
    /safari/.test(userAgent) && !/chrome|crios|fxios|edgios|edg|opr\//.test(userAgent);
  return {
    isIosSafari: isIos && isSafari,
    isAndroid: /android/.test(userAgent),
  };
};

export function usePwaInstall() {
  const [isInstalled, setIsInstalled] = useState(isStandaloneMode);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [visitCount, setVisitCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    return readStorageNumber(window.localStorage, INSTALL_VISIT_COUNT_KEY, 0);
  });
  const [dismissedAt, setDismissedAt] = useState(() => {
    if (typeof window === "undefined") return 0;
    return readStorageNumber(window.localStorage, INSTALL_BANNER_DISMISSED_AT_KEY, 0);
  });
  const [bannerHiddenForSession, setBannerHiddenForSession] = useState(false);
  const [platformDetails] = useState(resolvePlatformDetails);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(INSTALL_SESSION_VISIT_KEY) === "1") return;
    window.sessionStorage.setItem(INSTALL_SESSION_VISIT_KEY, "1");
    const currentCount = readStorageNumber(window.localStorage, INSTALL_VISIT_COUNT_KEY, 0);
    const nextCount = currentCount + 1;
    window.localStorage.setItem(INSTALL_VISIT_COUNT_KEY, String(nextCount));
    setVisitCount(nextCount);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateInstalledState = () => {
      setIsInstalled(isStandaloneMode());
    };

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredInstallPrompt(null);
      setBannerHiddenForSession(true);
    };

    const displayModeMediaQuery = window.matchMedia?.("(display-mode: standalone)");
    updateInstalledState();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (displayModeMediaQuery) {
      if (typeof displayModeMediaQuery.addEventListener === "function") {
        displayModeMediaQuery.addEventListener("change", updateInstalledState);
      } else if (typeof displayModeMediaQuery.addListener === "function") {
        displayModeMediaQuery.addListener(updateInstalledState);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (!displayModeMediaQuery) return;
      if (typeof displayModeMediaQuery.removeEventListener === "function") {
        displayModeMediaQuery.removeEventListener("change", updateInstalledState);
      } else if (typeof displayModeMediaQuery.removeListener === "function") {
        displayModeMediaQuery.removeListener(updateInstalledState);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !dismissedAt) return;
    if (Date.now() - dismissedAt <= 7 * DAY_MS) return;
    window.localStorage.removeItem(INSTALL_BANNER_DISMISSED_AT_KEY);
    setDismissedAt(0);
  }, [dismissedAt]);

  const hideInstallBanner = useCallback(() => {
    setBannerHiddenForSession(true);
  }, []);

  const dismissInstallBannerForDays = useCallback((days = 7) => {
    if (typeof window === "undefined") return;
    const parsedDays = Number(days);
    const safeDays = Number.isFinite(parsedDays) ? Math.min(7, Math.max(1, parsedDays)) : 7;
    const now = Date.now();
    const adjustedDismissedAt = now - (7 - safeDays) * DAY_MS;
    window.localStorage.setItem(INSTALL_BANNER_DISMISSED_AT_KEY, String(adjustedDismissedAt));
    setDismissedAt(adjustedDismissedAt);
    setBannerHiddenForSession(true);
  }, []);

  const requestInstall = useCallback(async () => {
    if (isInstalled) {
      return { status: "installed" };
    }

    if (!deferredInstallPrompt) {
      return { status: "manual" };
    }

    try {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
      if (choice?.outcome === "accepted") {
        return { status: "accepted" };
      }
      return { status: "dismissed" };
    } catch (error) {
      console.error("Install prompt failed:", error);
      setDeferredInstallPrompt(null);
      return { status: "manual" };
    }
  }, [deferredInstallPrompt, isInstalled]);

  const canPromptInstall = Boolean(deferredInstallPrompt);
  const cooldownActive = useMemo(() => {
    if (!dismissedAt) return false;
    return Date.now() - dismissedAt < 7 * DAY_MS;
  }, [dismissedAt]);
  const canInstall = !isInstalled;
  const shouldShowInstallBanner = canInstall && !bannerHiddenForSession && !cooldownActive && visitCount >= 2;

  return {
    canInstall,
    canPromptInstall,
    dismissInstallBannerForDays,
    hideInstallBanner,
    isAndroid: platformDetails.isAndroid,
    isInstalled,
    isIosSafari: platformDetails.isIosSafari,
    requestInstall,
    shouldShowInstallBanner,
  };
}

export default usePwaInstall;
