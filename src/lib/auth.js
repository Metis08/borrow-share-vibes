/**
 * Centralized Authentication & Session Management for Mohalla Store
 *
 * - The JWT is the single source of truth for authenticated state.
 * - Automatically validates JWT expiry (exp claim) client-side before any request.
 * - Installs a global fetch interceptor that traps 401 Unauthorized responses
 *   and expired tokens, immediately evicting the stale session and triggering Login.
 * - Broadcasts AUTH_CHANGE_EVENT and SESSION_EXPIRED_EVENT to synchronize all views.
 */

import { useState, useEffect } from "react";

export const STORAGE_KEY = "mohalla_user";
export const AUTH_CHANGE_EVENT = "mohalla_auth_change";
export const SESSION_EXPIRED_EVENT = "mohalla_session_expired";

/**
 * Safely parse a JWT string and return its JSON payload.
 * Returns null if token is missing, invalid, or malformed.
 */
export function parseJwt(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

    const binaryStr =
      typeof window !== "undefined" && typeof atob === "function"
        ? atob(padded)
        : typeof Buffer !== "undefined"
          ? Buffer.from(padded, "base64").toString("binary")
          : "";

    if (!binaryStr) return null;

    const json = decodeURIComponent(
      binaryStr
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(json);
  } catch (e) {
    try {
      const raw =
        typeof window !== "undefined" && typeof atob === "function"
          ? atob(parts[1])
          : typeof Buffer !== "undefined"
            ? Buffer.from(parts[1], "base64").toString("utf8")
            : "";
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

/**
 * Check if a JWT token is structurally valid and not expired.
 * A 5-second buffer is used to prevent edge-of-expiry race conditions.
 */
export function isTokenValid(token) {
  if (!token || typeof token !== "string") return false;
  const payload = parseJwt(token);
  if (!payload || typeof payload.exp !== "number") return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp > nowSeconds + 5;
}

let hadExpiredSessionOnStartup = false;

/**
 * Get the currently stored user session from localStorage.
 * If the stored token is missing, expired, or invalid, it silently
 * clears the storage and returns null without firing automatic modals on page load.
 */
export function getStoredUser() {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const user = JSON.parse(raw);
    if (!user || !user.token) {
      try {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {}
      return null;
    }

    if (!isTokenValid(user.token)) {
      console.warn("[Auth] Stored JWT has expired. Silently clearing stored session.");
      try {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {}
      return null;
    }

    return user;
  } catch (e) {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
    return null;
  }
}

/**
 * Check if an expired session was detected and evicted on initial startup.
 * Always returns false to prevent unprompted auth modal popups on initial page load.
 */
export function didSessionExpireOnStartup() {
  return false;
}

export function resetSessionExpiredOnStartupFlag() {
  hadExpiredSessionOnStartup = false;
}

/**
 * Clear authentication session from storage and notify all subscribers.
 */
export function clearSession(reason = "logout") {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}

  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: null }));

  if (reason !== "logout") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { reason } }));
  }
}

/**
 * Save new authenticated user session to storage and notify all subscribers.
 */
export function setStoredUser(userSession) {
  if (typeof window === "undefined") return;

  if (!userSession || !userSession.token || !isTokenValid(userSession.token)) {
    console.error("[Auth] Attempted to store an invalid or expired user session.");
    clearSession("invalid_token");
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userSession));
  } catch (e) {
    console.error("[Auth] Failed to write user to localStorage:", e);
  }

  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: userSession }));
}

/**
 * Centralized Authenticated Fetch Wrapper
 * Validates token prior to sending; if expired, halts the request,
 * clears the session, and throws an AuthError.
 * Traps any 401 responses and triggers immediate session eviction and login.
 */
export async function authFetch(url, options = {}) {
  const user = getStoredUser();

  if (!user || !user.token || !isTokenValid(user.token)) {
    console.warn("[Auth] Authenticated request blocked — no valid JWT token available:", url);
    clearSession("token_missing_or_expired");
    const err = new Error("Unauthorized: Invalid or expired token");
    err.status = 401;
    throw err;
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${user.token}`);

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    console.warn("[Auth] 401 Unauthorized returned by server for:", url);
    clearSession("server_401");
    const err = new Error("Unauthorized: Invalid or expired token");
    err.status = 401;
    throw err;
  }

  return res;
}

/**
 * Global Fetch Interceptor
 * Installed once on browser window to catch any direct fetch calls that receive 401.
 */
export function installGlobalAuthInterceptor() {
  if (typeof window === "undefined" || window.__mohalla_auth_interceptor_installed__) {
    return;
  }
  window.__mohalla_auth_interceptor_installed__ = true;

  const nativeFetch = window.fetch;

  window.fetch = async function (input, init = {}) {
    // If request includes Authorization: Bearer <token>, check if token is expired before sending
    let token = null;
    if (init && init.headers) {
      if (init.headers instanceof Headers) {
        const auth = init.headers.get("Authorization");
        if (auth && auth.startsWith("Bearer ")) token = auth.slice(7).trim();
      } else if (typeof init.headers === "object") {
        const auth = init.headers["Authorization"] || init.headers["authorization"];
        if (auth && auth.startsWith("Bearer ")) token = auth.slice(7).trim();
      }
    }

    if (token && !isTokenValid(token)) {
      console.warn("[Auth Interceptor] Request aborted: token is expired before send:", input);
      clearSession("expired");
      return new Response("Unauthorized: Invalid or expired token", {
        status: 401,
        statusText: "Unauthorized",
      });
    }

    const response = await nativeFetch.apply(this, [input, init]);

    if (response.status === 401) {
      const urlStr = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      // Exclude public login / register endpoints from triggering session eviction
      if (!urlStr.includes("/api/login") && !urlStr.includes("/api/register")) {
        console.warn("[Auth Interceptor] Caught 401 Unauthorized for:", urlStr);
        clearSession("unauthorized_response");
      }
    }

    return response;
  };
}

// Automatically install in browser runtime
if (typeof window !== "undefined") {
  installGlobalAuthInterceptor();
}

/**
 * React Hook for Global Authentication State
 */
export function useCurrentUser() {
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    // Sync on mount
    setUser(getStoredUser());

    const handleAuthChange = (e) => {
      setUser(e.detail || null);
    };

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    };
  }, []);

  return [user, setUser];
}
