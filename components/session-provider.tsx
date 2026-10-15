"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

type User = { id: string; name: string };

type SessionContextValue = {
  user: User | null;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Primer render sin sesión (igual que el servidor); se hidrata en useEffect.
  const [user, setUser] = useState<User | null>(null);
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const reqId = useRef(0);

  // Lee la sesión (cookies) y el perfil. Sin perfil (OAuth sin username) = invitado.
  const sync = useCallback(async () => {
    const id = ++reqId.current;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (id !== reqId.current) return;
    if (!session) {
      setUser(null);
      return;
    }
    const uid = session.user.id;
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", uid)
      .maybeSingle();
    if (id !== reqId.current) return;
    const next = data?.username
      ? { id: uid, name: data.username as string }
      : null;
    setUser((prev) =>
      prev?.id === next?.id && prev?.name === next?.name ? prev : next,
    );
  }, [supabase]);

  // Las Server Actions cambian las cookies sin avisar al cliente: se relee al navegar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void sync();
  }, [sync, pathname]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      // Diferido: no llamar a Supabase dentro del callback.
      setTimeout(() => void sync(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase, sync]);

  const logout = useCallback(async () => {
    reqId.current++;
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  const value = useMemo(() => ({ user, logout }), [user, logout]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx)
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
