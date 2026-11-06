/**
 * Small module-level store for PWA state (install prompt + "new version ready").
 * It lives outside React because the browser fires `beforeinstallprompt` once, often before any
 * component that wants to show an "Install app" button has mounted.
 */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type PwaSnapshot = {
  /** The browser offered an install prompt we can trigger. */
  canInstall: boolean;
  /** Running as an installed app already. */
  installed: boolean;
  /** iPhone/iPad Safari: no prompt API, the user must use Share → Add to Home Screen. */
  iosManual: boolean;
  /** A newer version of the app has been downloaded and is waiting for a refresh. */
  updateReady: boolean;
};

const SERVER_SNAPSHOT: PwaSnapshot = { canInstall: false, installed: false, iosManual: false, updateReady: false };

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let snapshot: PwaSnapshot = SERVER_SNAPSHOT;
let started = false;
const listeners = new Set<() => void>();

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true;
}

export function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && window.navigator.maxTouchPoints > 1);
  const webkitOnly = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua);
  return ios && webkitOnly;
}

function publish(patch: Partial<PwaSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

/** Idempotent. Called once from the root layout. */
export function startPwaStore() {
  if (started || typeof window === "undefined") return;
  started = true;
  const installed = isStandaloneDisplay();
  publish({ installed, iosManual: !installed && isIosSafari() });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    publish({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    publish({ canInstall: false, installed: true, iosManual: false });
  });
  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", (event) => {
    publish({ installed: event.matches });
  });
}

export function subscribePwa(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPwaSnapshot(): PwaSnapshot {
  return snapshot;
}

export function getPwaServerSnapshot(): PwaSnapshot {
  return SERVER_SNAPSHOT;
}

export function markUpdateReady() {
  publish({ updateReady: true });
}

/** Shows the browser's install dialog. Returns true when the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const prompt = deferredPrompt;
  if (!prompt) return false;
  deferredPrompt = null;
  publish({ canInstall: false });
  await prompt.prompt();
  const choice = await prompt.userChoice;
  return choice.outcome === "accepted";
}
