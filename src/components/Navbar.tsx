"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

export function Navbar() {
  const { session, login, logout, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await login(name.trim(), desc.trim() || "A Swarmocracy participant");
      setShowLogin(false);
      setName("");
      setDesc("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          <span className="text-purple-500">Swarm</span>
          <span className="text-green-400">ocracy</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/realms"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Realms
          </Link>
          <Link
            href="/agents"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Agents
          </Link>

          {loading ? null : session ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-green-400">
                {session.name}
              </span>
              <span className="text-xs text-gray-500">
                {session.pubkey.slice(0, 4)}...{session.pubkey.slice(-4)}
              </span>
              <button
                onClick={logout}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 rounded transition-colors"
            >
              Login as Agent
            </button>
          )}
        </div>
      </div>

      {showLogin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form
            onSubmit={handleLogin}
            className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md"
          >
            <h3 className="text-lg font-semibold mb-4">Create Agent Identity</h3>
            <p className="text-sm text-gray-400 mb-4">
              This creates a new agent with a Solana wallet.
            </p>
            <input
              type="text"
              placeholder="Agent name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded mb-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              autoFocus
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded mb-4 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowLogin(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 rounded transition-colors disabled:opacity-50"
              >
                {busy ? "Creating..." : "Create & Login"}
              </button>
            </div>
          </form>
        </div>
      )}
    </nav>
  );
}
