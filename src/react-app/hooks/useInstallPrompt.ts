import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const VISIT_COUNT_KEY = "toodrop_pwa_visit_count";
const LAST_VISIT_DATE_KEY = "toodrop_pwa_last_visit_date";
const DISMISSED_UNTIL_KEY = "toodrop_pwa_install_dismissed_until";
const INSTALLED_KEY = "toodrop_pwa_installed";

// Show the banner starting on the 3rd distinct day the app is opened.
const VISIT_THRESHOLD = 3;
// After "not now", wait 14 days before asking again.
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isEligible(hasNativePrompt: boolean) {
  if (isStandaloneDisplay()) {
    localStorage.setItem(INSTALLED_KEY, "1");
    return false;
  }
  if (localStorage.getItem(INSTALLED_KEY) === "1") return false;
  if (!hasNativePrompt && !isIOSDevice()) return false;

  const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || "0", 10);
  if (visitCount < VISIT_THRESHOLD) return false;

  const dismissedUntil = parseInt(localStorage.getItem(DISMISSED_UNTIL_KEY) || "0", 10);
  if (dismissedUntil && Date.now() < dismissedUntil) return false;

  return true;
}

export type InstallPromptPlatform = "native" | "ios" | null;

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<InstallPromptPlatform>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      localStorage.setItem(INSTALLED_KEY, "1");
      return;
    }
    if (localStorage.getItem(INSTALLED_KEY) === "1") return;

    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(LAST_VISIT_DATE_KEY) !== today) {
      const count = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || "0", 10) + 1;
      localStorage.setItem(VISIT_COUNT_KEY, String(count));
      localStorage.setItem(LAST_VISIT_DATE_KEY, today);
    }

    if (isIOSDevice() && isEligible(false)) {
      setPlatform("ios");
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      if (isEligible(true)) {
        setPlatform("native");
        setVisible(true);
      }
    };

    const handleAppInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "1");
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem(INSTALLED_KEY, "1");
    }
    setDeferredPrompt(null);
    setVisible(false);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_UNTIL_KEY, String(Date.now() + DISMISS_COOLDOWN_MS));
    setVisible(false);
  }, []);

  return { visible, platform, install, dismiss };
}
