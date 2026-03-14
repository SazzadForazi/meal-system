import { api } from "./api.js";

export async function login(email, password) {
  const data = await api.post("/auth/login", { email, password });
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data.user;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getUser() {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function refreshMe() {
  const data = await api.get("/auth/me");
  localStorage.setItem("user", JSON.stringify(data.user));
  return data.user;
}

