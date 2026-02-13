/**
 * Extension storage helper.
 * Uses chrome.storage.local when running as an extension.
 * Falls back to localStorage in regular web dev (CRA on localhost).
 */

const STORAGE_KEY = "brandprompt_settings_v1";

/**
 * Read the extension API object without relying on `globalThis` (which can trip
 * CRA's ESLint `no-undef` depending on config).
 */
function getGlobal() {
  if (typeof window !== "undefined") return window;

  try {
    // Non-strict eval alternative; returns the global object in most JS envs,
    // including extension service workers (where `window` is undefined).
    // eslint-disable-next-line no-new-func
    return Function("return this")();
  } catch {
    return undefined;
  }
}

function getChrome() {
  const g = getGlobal();
  return g ? g.chrome : undefined;
}

/**
 * PUBLIC_INTERFACE
 * Load settings from extension storage.
 * @returns {Promise<object>} settings object (or default empty object)
 */
export async function loadSettings() {
  const chromeApi = getChrome();

  try {
    if (chromeApi?.storage?.local) {
      const result = await chromeApi.storage.local.get([STORAGE_KEY]);
      return result?.[STORAGE_KEY] ?? {};
    }
  } catch (e) {
    // Fall through to localStorage
    console.warn("chrome.storage.local get failed, falling back:", e);
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn("localStorage get failed:", e);
    return {};
  }
}

/**
 * PUBLIC_INTERFACE
 * Save settings to extension storage.
 * @param {object} settings Settings object to persist
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  const chromeApi = getChrome();

  try {
    if (chromeApi?.storage?.local) {
      await chromeApi.storage.local.set({ [STORAGE_KEY]: settings });
      return;
    }
  } catch (e) {
    console.warn("chrome.storage.local set failed, falling back:", e);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings ?? {}));
  } catch (e) {
    console.warn("localStorage set failed:", e);
  }
}
