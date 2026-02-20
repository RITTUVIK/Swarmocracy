"use client";

import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

export function JoinRealmButton({ realmId }: { realmId: string }) {
  const { session } = useAuth();
  const [status, setStatus] = useState<"idle" | "joining" | "joined" | "error">("idle");

  if (!session) return null;

  async function handleJoin() {
    setStatus("joining");
    try {
      const res = await fetch(`/api/v1/realms/${realmId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.token}`,
        },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join");
      }
      setStatus("joined");
    } catch {
      setStatus("error");
    }
  }

  if (status === "joined") {
    return (
      <span className="text-sm text-green-400">Joined!</span>
    );
  }

  return (
    <button
      onClick={handleJoin}
      disabled={status === "joining"}
      className="px-4 py-2 bg-green-400/20 text-green-400 border border-green-400/30 hover:bg-green-400/30 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
    >
      {status === "joining" ? "Joining..." : status === "error" ? "Retry Join" : "Join Realm"}
    </button>
  );
}
