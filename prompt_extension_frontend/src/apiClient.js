/**
 * Backend API client for the extension popup.
 *
 * Endpoints (per backend OpenAPI):
 * - GET  /              health check
 * - GET  /config        supported options + backend metadata
 * - GET  /settings/defaults  defaults for initializing UI
 * - POST /prompts/generate   generate a prompt from user inputs
 */

const DEFAULT_BASE_URL = "http://localhost:3001";

/**
 * Try to infer a reasonable backend URL when running in environments where
 * localhost isn't correct (e.g., hosted preview, extension popup in browser).
 *
 * We keep this as a "best-effort" helper; the user can always override via UI.
 */
function inferBackendUrlFromWindowLocation() {
  if (typeof window === "undefined") return null;

  const { hostname, protocol } = window.location;

  // CRA dev server: default backend is localhost
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return DEFAULT_BASE_URL;
  }

  // Kavia preview style (often same host, different port).
  // If the frontend is served on :3000, backend tends to be :3001.
  // This is only a heuristic and can be overridden in settings.
  const backendPort = "3001";
  return `${protocol}//${hostname}:${backendPort}`;
}

/**
 * PUBLIC_INTERFACE
 * Resolve backend base URL from saved settings, environment, or a sensible default.
 * @param {object} settings
 * @returns {string}
 */
export function resolveBaseUrl(settings) {
  const fromSettings = settings?.backendBaseUrl?.trim();
  const chosen = fromSettings || inferBackendUrlFromWindowLocation() || DEFAULT_BASE_URL;

  // Normalize: remove trailing slashes
  return chosen.replace(/\/+$/, "");
}

async function safeReadBodyText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function safeReadJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function makeHttpError({ message, status, bodyText }) {
  const err = new Error(message);
  err.status = status;
  err.bodyText = bodyText;
  return err;
}

/**
 * PUBLIC_INTERFACE
 * Health check call to backend.
 * @param {string} baseUrl
 * @returns {Promise<{ok: boolean, status: number, bodyText: string}>}
 */
export async function healthCheck(baseUrl) {
  const res = await fetch(`${baseUrl}/`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const bodyText = await safeReadBodyText(res);
  return { ok: res.ok, status: res.status, bodyText };
}

/**
 * PUBLIC_INTERFACE
 * Fetch supported options / public config for populating dropdowns.
 * @param {string} baseUrl
 * @returns {Promise<object>} PublicConfigResponse
 */
export async function getPublicConfig(baseUrl) {
  const res = await fetch(`${baseUrl}/config`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const bodyText = await safeReadBodyText(res);
    throw makeHttpError({
      message: `Failed to load config (${res.status})`,
      status: res.status,
      bodyText,
    });
  }

  const json = await safeReadJson(res);
  if (!json) {
    const bodyText = await safeReadBodyText(res);
    throw makeHttpError({
      message: "Config response was not valid JSON",
      status: res.status,
      bodyText,
    });
  }

  return json;
}

/**
 * PUBLIC_INTERFACE
 * Fetch backend-provided default settings.
 * @param {string} baseUrl
 * @returns {Promise<object>} DefaultSettingsResponse
 */
export async function getDefaultSettings(baseUrl) {
  const res = await fetch(`${baseUrl}/settings/defaults`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const bodyText = await safeReadBodyText(res);
    throw makeHttpError({
      message: `Failed to load defaults (${res.status})`,
      status: res.status,
      bodyText,
    });
  }

  const json = await safeReadJson(res);
  if (!json) {
    const bodyText = await safeReadBodyText(res);
    throw makeHttpError({
      message: "Defaults response was not valid JSON",
      status: res.status,
      bodyText,
    });
  }

  return json;
}

/**
 * Map UI values to backend enums expected by the API.
 * Backend:
 *  Orientation: post|ad|email|landing_page|other
 *  Platform: instagram|tiktok|facebook|linkedin|x|youtube|blog|website|other
 */
function mapOrientation(uiOrientation) {
  const v = (uiOrientation || "").toLowerCase();
  if (v === "post") return "post";
  if (v === "ad") return "ad";
  if (v === "email") return "email";
  if (v === "landing page" || v === "landing_page") return "landing_page";
  return "other";
}

function mapPlatform(uiPlatform) {
  const v = (uiPlatform || "").toLowerCase();
  if (v === "linkedin") return "linkedin";
  if (v === "x (twitter)" || v === "x" || v === "twitter") return "x";
  if (v === "instagram") return "instagram";
  if (v === "facebook") return "facebook";
  if (v === "tiktok") return "tiktok";
  // UI includes Google Ads; backend doesn't include it explicitly -> "other"
  if (v === "google ads" || v === "google_ads") return "other";
  return "other";
}

/**
 * PUBLIC_INTERFACE
 * Generate a prompt using backend.
 *
 * @param {string} baseUrl
 * @param {object} settings Current UI settings
 * @returns {Promise<{prompt: string, metadata?: object}>} PromptGenerateResponse
 */
export async function generatePrompt(baseUrl, settings) {
  const brandName = settings?.brandName?.trim();
  if (!brandName) {
    throw new Error("Brand name is required to generate a prompt.");
  }

  const brief = settings?.topic?.trim() || settings?.context?.trim();
  if (!brief) {
    throw new Error("Topic (or Context) is required to generate a prompt.");
  }

  // Convert simple UI fields into backend schema
  const keywords = (settings?.keywords || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const requestBody = {
    orientation: mapOrientation(settings?.orientation),
    platform: mapPlatform(settings?.platform),
    brief,
    additional_context: settings?.context?.trim() || null,
    brand: {
      brand_name: brandName,
      description: settings?.context?.trim() || null,
      target_audience: settings?.audience?.trim() || null,
      voice: {
        // Backend tone options come from /config; we use a reasonable default.
        tone: "professional",
        keywords,
        // We don't have a separate "avoid" field in UI; derive from brandDont.
        avoid: settings?.brandDont
          ? [String(settings.brandDont).trim()].filter(Boolean)
          : [],
      },
    },
    style: {
      // We don't expose these in UI yet; keep backend defaults-ish.
      length: "medium",
      include_hashtags: true,
      emoji_level: 0,
      formatting_notes: settings?.brandDo?.trim() || null,
    },
  };

  const res = await fetch(`${baseUrl}/prompts/generate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const bodyText = await safeReadBodyText(res);
    throw makeHttpError({
      message: `Generate failed (${res.status})`,
      status: res.status,
      bodyText,
    });
  }

  const json = await safeReadJson(res);
  if (!json || typeof json.prompt !== "string") {
    const bodyText = await safeReadBodyText(res);
    throw makeHttpError({
      message: "Generate response was not valid JSON (or missing prompt)",
      status: res.status,
      bodyText,
    });
  }

  return json;
}
