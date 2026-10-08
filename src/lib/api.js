/**
 * Centralized API & WebSocket Configuration for Mohalla Store
 *
 * Local development:
 *   API_BASE -> http://localhost:8085
 *   wsUrl    -> ws://localhost:8085/api/...
 *
 * Production (e.g. Render):
 *   Configured via import.meta.env.VITE_API_URL (e.g. https://mohalla-backend.onrender.com)
 *   API_BASE -> https://mohalla-backend.onrender.com
 *   wsUrl    -> wss://mohalla-backend.onrender.com/api/...
 */

export const API_BASE = (() => {
  const envUrl =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
      ? String(import.meta.env.VITE_API_URL).replace(/\/+$/, "")
      : "http://localhost:8085";

  if (
    typeof window !== "undefined" &&
    window.location.hostname &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    if (envUrl.includes("localhost") || envUrl.includes("127.0.0.1")) {
      const protocol = window.location.protocol || "http:";
      return `${protocol}//${window.location.hostname}:8085`;
    }
  }

  return envUrl;
})();

/**
 * Returns a fully-qualified HTTP/HTTPS API URL.
 * Handles paths with or without leading slashes, as well as already-qualified URLs.
 *
 * @param {string} path - e.g. "/api/profile" or "uploads/image.png"
 * @returns {string} Fully qualified URL
 */
export function apiUrl(path = "") {
  if (!path) return API_BASE;
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

/**
 * Returns a fully-qualified WebSocket URL (ws:// for http, wss:// for https).
 *
 * @param {string} path - e.g. "/api/conversations/ws?token=..."
 * @returns {string} Fully qualified WebSocket URL
 */
export function wsUrl(path = "") {
  if (path.startsWith("ws://") || path.startsWith("wss://")) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const wsBase = API_BASE.replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://");
  return `${wsBase}${cleanPath}`;
}
