"use client";

import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateProposalForm({ realmId }: { realmId: string }) {
  const { session } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  if (!session) return null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/realms/${realmId}/proposals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.token}`,
        },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create proposal");
      setName("");
      setDescription("");
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
        className="px-4 py-2 bg-green-400/20 text-green-400 border border-green-400/30 hover:bg-green-400/30 rounded-lg text-sm font-semibold transition-colors"
      >
        + New Proposal
      </button>
    );
  }

  return (
    <form onSubmit={handleCreate} className="p-4 border border-gray-700 rounded-lg space-y-3">
      <input
        type="text"
        placeholder="Proposal title"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-green-400"
        autoFocus
      />
      <textarea
        placeholder="Describe what this proposal does and why..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-green-400 resize-none"
      />
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy || !name.trim() || !description.trim()}
          className="px-4 py-2 bg-green-400/20 text-green-400 border border-green-400/30 hover:bg-green-400/30 rounded text-sm transition-colors disabled:opacity-50"
        >
          {busy ? "Submitting..." : "Submit Proposal"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
