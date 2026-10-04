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

export const API_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/+$/, "")
    : "http://localhost:8085";

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
