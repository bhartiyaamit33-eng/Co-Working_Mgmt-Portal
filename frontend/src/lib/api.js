import axios from "axios";

function resolveBackendUrl() {
  const raw = process.env.REACT_APP_BACKEND_URL;
  if (raw && raw !== "undefined") return String(raw).replace(/\/$/, "");
  // Use localhost (not 127.0.0.1) so dev matches http://localhost:3000 for SameSite cookies.
  if (process.env.NODE_ENV === "development") return "http://localhost:8000";
  return "";
}

export const BACKEND_URL = resolveBackendUrl();
export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

/** In-memory access token from POST /auth/login (backend also sets httpOnly cookies when possible). */
let sessionAccessToken = null;

export function setSessionAccessToken(token) {
  sessionAccessToken = token || null;
}

export function clearSessionAccessToken() {
  sessionAccessToken = null;
}

// httpOnly cookies are sent automatically via withCredentials when same-site.
// Bearer supplements login when localhost vs 127.0.0.1 would block cookies.
const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (sessionAccessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${sessionAccessToken}`;
  }
  return config;
});

/** FastAPI `detail` only — returns null if absent so callers can fall back to `error.message`. */
export function formatApiErrorDetail(detail) {
  if (detail == null) return null;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

/** Full axios error: API detail, HTTP status, network/CORS, or fallback message. */
export function formatRequestError(error) {
  const detailMsg = formatApiErrorDetail(error?.response?.data?.detail);
  if (detailMsg) return detailMsg;

  const status = error?.response?.status;
  const statusText = error?.response?.statusText;
  if (status) {
    const bits = [`HTTP ${status}`];
    if (statusText) bits.push(statusText);
    return `Request failed (${bits.join(" — ")}).`;
  }

  if (error?.code === "ERR_NETWORK" || error?.message === "Network Error") {
    return "Cannot reach the API. Start the backend (port 8000), check REACT_APP_BACKEND_URL, and try again.";
  }

  if (typeof error?.message === "string" && error.message.trim()) return error.message;

  return "Something went wrong. Please try again.";
}

export default api;
