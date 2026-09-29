import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const CHUNK_RELOAD_SESSION_KEY = "phindu-chunk-reload-attempted";

/** Matches Vite/React lazy failures after a new deploy (missing hashed chunk). */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

/** One automatic hard reload per tab when a stale bundle is detected. */
export function tryRecoverFromChunkLoadError(error: unknown): boolean {
  if (!isChunkLoadError(error)) return false;
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") return false;
  if (sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)) return false;
  sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, "1");
  window.location.reload();
  return true;
}

export function clearChunkReloadAttemptFlag(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Call once at app bootstrap (staff + borrower).
 * Handles Vite preload failures and unhandled dynamic import rejections.
 */
export function setupChunkLoadRecovery(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    tryRecoverFromChunkLoadError(new Error("vite:preloadError"));
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (tryRecoverFromChunkLoadError(event.reason)) {
      event.preventDefault();
    }
  });

  window.addEventListener("load", () => {
    clearChunkReloadAttemptFlag();
  });
}

type LazyModule<T extends ComponentType<any>> = { default: T };

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<LazyModule<T>>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      if (tryRecoverFromChunkLoadError(error)) {
        return new Promise(() => {
          /* reload in progress */
        });
      }
      throw error;
    }
  });
}
