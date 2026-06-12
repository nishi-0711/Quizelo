const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5002/api";

function getToken() {
  return localStorage.getItem("quizelo_token");
}

export function setToken(token) {
  if (!token) localStorage.removeItem("quizelo_token");
  else localStorage.setItem("quizelo_token", token);
}

export function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = "GET", headers, body } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...getAuthHeaders(),
      ...headers,
    },
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });

  const text = await res.text();
  const data = text ? (() => {
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  })() : null;

  if (!res.ok) {
    const message = data?.error || data?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  signup: (email, password, username) =>
    request("/auth/signup", { method: "POST", body: { email, password, username } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  logout: () => request("/auth/logout", { method: "POST" }),

  getProfile: () => request("/profile/me"),
  updateProfile: ({ username }) => request("/profile/me", { method: "PATCH", body: { username } }),
  getHistory: () => request("/history"),
  getResult: (sessionId) => request(`/history/${sessionId}`),
  deleteHistory: (sessionId) => request(`/history/${sessionId}`, { method: "DELETE" }),

  extractPdf: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/pdf/extract", { method: "POST", body: fd });
  },

  generateQuiz: ({ sourceText, questionType, difficulty, count, selectedTopics }) =>
    request("/quiz/generate", { method: "POST", body: { sourceText, questionType, difficulty, count, selectedTopics } }),

  createSession: ({ questions, timeLimitSec }) =>
    request("/gameplay/sessions", { method: "POST", body: { questions, timeLimitSec } }),
  getSession: (id) => request(`/gameplay/sessions/${id}`),
  getQuestion: (id, index) => request(`/gameplay/sessions/${id}/question?index=${index}`),
  submitAnswer: (id, { index, answer }) => request(`/gameplay/sessions/${id}/answer`, { method: "POST", body: { index, answer } }),
  quitSession: (id) => request(`/gameplay/sessions/${id}/quit`, { method: "POST" }),
};

