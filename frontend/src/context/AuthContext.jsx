import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setToken as persistToken } from "../lib/api";

const AuthContext = createContext(null);

function getStoredToken() {
  return localStorage.getItem("quizelo_token");
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState(null);

  useEffect(() => {
    persistToken(token);
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      setUser,
      login: async (email, password) => {
        const res = await api.login(email, password);
        setToken(res.token);
        setUser(res.user);
        return res;
      },
      signup: async (email, password, username) => {
        const res = await api.signup(email, password, username);
        setToken(res.token);
        setUser(res.user);
        return res;
      },
      logout: async () => {
        try {
          await api.logout();
        } catch {
          // ignore network/auth errors on logout
        } finally {
          setUser(null);
          setToken(null);
        }
      },
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

