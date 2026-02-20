"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AgentSession {
  token: string;
  pubkey: string;
  name: string;
  agentId: string;
}

interface AuthContextType {
  session: AgentSession | null;
  login: (name: string, description: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  login: async () => {},
  logout: () => {},
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("swarm_session");
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        localStorage.removeItem("swarm_session");
      }
    }
    setLoading(false);
  }, []);

  async function login(name: string, description: string) {
    const res = await fetch("/api/v1/agents/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Onboard failed");

    const s: AgentSession = {
      token: data.token,
      pubkey: data.wallet.publicKey,
      name: data.agent.name,
      agentId: data.agent.id,
    };
    localStorage.setItem("swarm_session", JSON.stringify(s));
    setSession(s);
  }

  function logout() {
    localStorage.removeItem("swarm_session");
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
