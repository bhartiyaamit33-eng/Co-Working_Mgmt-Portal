import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { formatApiErrorDetail } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // null = checking, false = not authed, object = authed
  const [team, setTeam] = useState(null);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setTeam(data.team);
      return data.user;
    } catch (e) {
      // 401 here is expected when not logged in — only log unexpected errors.
      if (e?.response?.status && e.response.status !== 401) {
        // eslint-disable-next-line no-console
        console.error("auth/me failed:", e);
      }
      setUser(false);
      setTeam(null);
      return false;
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (email, password) => {
    await api.post("/auth/login", { email, password });
    return await refreshMe();
  };

  const signup = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    return data;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("logout failed:", e);
    }
    setUser(false);
    setTeam(null);
  };

  return (
    <AuthContext.Provider value={{ user, team, login, signup, logout, refreshMe, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { formatApiErrorDetail };
