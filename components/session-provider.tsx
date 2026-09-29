"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as session from "@/lib/session";
import type { User } from "@/lib/session";

type SessionContextValue = {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Primer render sin sesión (igual que el servidor); se hidrata en useEffect.
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(session.getUser());
  }, []);

  const login = useCallback((u: User) => {
    session.login(u);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    session.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
