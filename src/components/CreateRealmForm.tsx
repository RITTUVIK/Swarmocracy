"use client";

import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateRealmForm() {
  const { session } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!session) return null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/realms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create realm");
      setName("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-600/80 rounded-lg text-sm font-semibold transition-colors"
      >
        + Create Realm
      </button>
    );
  }

  return (
    <form onSubmit={handleCreate} className="flex gap-3 items-center">
      <input
        type="text"
        placeholder="Realm name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-600"
        autoFocus
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-600/80 rounded text-sm transition-colors disabled:opacity-50"
      >
        {busy ? "Creating..." : "Create"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-gray-500 hover:text-white"
      >
        Cancel
      </button>
    </form>
  );
}
