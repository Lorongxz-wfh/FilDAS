// src/lib/api.ts
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
    // baseURL: "http://localhost:8000/api",
});


// helper to set/remove token
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

// NEW: load token from localStorage on startup
const saved = localStorage.getItem("fildas_token");
if (saved) {
  setAuthToken(saved);
}

// Dashboard + activity convenience helpers
export async function fetchDashboardSummary() {
  const res = await api.get("/dashboard/summary");
  return res.data;
}

export async function fetchRecentActivity(perPage = 10) {
  const res = await api.get("/activity-logs", {
    params: { per_page: perPage, page: 1 },
  });
  return res.data;
}
