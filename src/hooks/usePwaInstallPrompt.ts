import { useSyncExternalStore } from "react";

export interface BeforeInstallPromptEventLike extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEventLike | null = null;
let storeVersion = 0;
const subscribers = new Set<() => void>();

function emit() {
  storeVersion += 1;
  subscribers.forEach((cb) => cb());
}

function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function getServerSnapshot() {
  return 0;
}

function getClientSnapshot() {
  return storeVersion;
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEventLike;
    emit();
  });
}

/**
 * Shared Chromium install prompt. iOS Safari does not fire `beforeinstallprompt`.
 */
export function usePwaInstallPrompt() {
  const version = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  void version;

  return {
    deferredPrompt: deferred,
    async promptInstall(): Promise<{ outcome: "accepted" | "dismissed" } | null> {
      if (!deferred) {
        return null;
      }
      const d = deferred;
      await d.prompt();
      const choice = await d.userChoice;
      deferred = null;
      emit();
      return choice;
    },
  };
}
