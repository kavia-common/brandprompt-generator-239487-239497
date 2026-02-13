/**
 * Backend API client.
 *
 * NOTE: The downloaded OpenAPI currently only exposes GET / (health check).
 * This client is structured so future endpoints (e.g. /generate) can be added
 * without changing UI wiring.
 */

const DEFAULT_BASE_URL = "http://localhost:3001";

/**
 * PUBLIC_INTERFACE
 * Resolve backend base URL from saved settings (or default).
 * @param {object} settings
 * @returns {string}
 */
export function resolveBaseUrl(settings) {
  const url = settings?.backendBaseUrl?.trim();
  return url ? url.replace(/\/+$/, "") : DEFAULT_BASE_URL;
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
  const bodyText = await res.text();
  return { ok: res.ok, status: res.status, bodyText };
}

/**
 * PUBLIC_INTERFACE
 * Placeholder generate call. Will throw until backend exposes an endpoint.
 * Keeping this public interface allows UI integration now.
 * @throws {Error}
 */
export async function generatePrompt() {
  throw new Error(
    "Generate endpoint not implemented on backend yet (OpenAPI only has GET /)."
  );
}
