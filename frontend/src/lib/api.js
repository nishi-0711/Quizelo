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

  getNotes: () => request("/notes"),
  getNote: (id) => request(`/notes/${id}`),
  deleteNote: (id) => request(`/notes/${id}`, { method: "DELETE" }),

  getFlashcardSets: () => request("/flashcards"),
  getFlashcardSet: (id) => request(`/flashcards/${id}`),
  generateFlashcards: ({ sourceText, pdfNames, count, difficulty, topics, chunks }) =>
    request("/flashcards/generate", { method: "POST", body: { sourceText, pdfNames, count, difficulty, topics, chunks } }),
  updateFlashcard: (id, index, patch) =>
    request(`/flashcards/${id}/cards/${index}`, { method: "PATCH", body: patch }),
  regenerateFlashcard: (id, index) =>
    request(`/flashcards/${id}/regenerate`, { method: "POST", body: { index } }),
  deleteFlashcardSet: (id) => request(`/flashcards/${id}`, { method: "DELETE" }),

  extractPdfs: (files) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return request("/pdf/extract", { method: "POST", body: fd });
  },

  generateQuiz: ({ sourceText, questionType, difficulty, count, selectedTopics, chunks }) =>
    request("/quiz/generate", { method: "POST", body: { sourceText, questionType, difficulty, count, selectedTopics, chunks } }),

  quizAssist: ({ action, question, options, answer, explanation, sourceText }) =>
    request("/quiz/assist", { method: "POST", body: { action, question, options, answer, explanation, sourceText } }),

  exportQuiz: async ({ questions, pdfName, format, settings }) => {
    const token = localStorage.getItem("quizelo_token");
    const res = await fetch(`${API_BASE_URL}/export/quiz`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ questions, pdfName, format, settings }),
    });

    if (!res.ok) {
      let msg = `Export failed (${res.status})`;
      try {
        const data = await res.json();
        msg = data?.error || msg;
      } catch { /* ignore */ }
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }

    // Derive filename from Content-Disposition header or build a fallback
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `Quiz_export.${format}`;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  createSession: ({ questions, timeLimitSec, lives, title, sourcePdfs, difficulty }) =>
    request("/gameplay/sessions", { method: "POST", body: { questions, timeLimitSec, lives, title, sourcePdfs, difficulty } }),
  getSession: (id) => request(`/gameplay/sessions/${id}`),
  getQuestion: (id, index) => request(`/gameplay/sessions/${id}/question?index=${index}`),
  submitAnswer: (id, { index, answer }) => request(`/gameplay/sessions/${id}/answer`, { method: "POST", body: { index, answer } }),
  quitSession: (id) => request(`/gameplay/sessions/${id}/quit`, { method: "POST" }),

  generateNotes: (sourceText, pdfNames) =>
    request("/notes/generate", { method: "POST", body: { sourceText, pdfNames } }),

  exportNotes: async ({ notes, pdfName, format }) => {
    const token = localStorage.getItem("quizelo_token");
    const res = await fetch(`${API_BASE_URL}/notes/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ notes, pdfName, format }),
    });

    if (!res.ok) {
      let msg = `Export failed (${res.status})`;
      try { const d = await res.json(); msg = d?.error || msg; } catch { /* ignore */ }
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }

    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `Notes_export.${format}`;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};


