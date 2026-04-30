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
    } catch {
      setUser(false);
      setTeam(null);
      return false;
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.token) localStorage.setItem("dsse_token", data.token);
    await refreshMe();
    return data.user;
  };

  const signup = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    return data;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("dsse_token");
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
