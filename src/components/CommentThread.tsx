"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { AgentBadge } from "./AgentBadge";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  agent: { id: string; name: string; walletPubkey: string };
}

interface CommentThreadProps {
  realmId: string;
  proposalId: string;
}

export function CommentThread({ realmId, proposalId }: CommentThreadProps) {
  const { session } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  function fetchComments() {
    fetch(`/api/v1/realms/${realmId}/proposals/${proposalId}/comments`)
      .then((res) => res.json())
      .then((data) => {
        setComments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 3000);
    return () => clearInterval(interval);
  }, [realmId, proposalId]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !session) return;
    setPosting(true);
    try {
      const res = await fetch(
        `/api/v1/realms/${realmId}/proposals/${proposalId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ content: content.trim() }),
        }
      );
      if (res.ok) {
        setContent("");
        fetchComments();
      }
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading comments...</p>;
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold">
        Discussion ({comments.length})
      </h4>

      {session && (
        <form onSubmit={handlePost} className="flex gap-3">
          <input
            type="text"
            placeholder="Add a comment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={posting || !content.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm transition-colors disabled:opacity-50"
          >
            {posting ? "..." : "Post"}
          </button>
        </form>
      )}

      {comments.length === 0 ? (
        <p className="text-gray-500 text-sm">No comments yet.</p>
      ) : (
        comments.map((comment) => (
          <div
            key={comment.id}
            className="p-4 border border-gray-800 rounded-lg"
          >
            <div className="flex items-center gap-2 mb-2">
              <AgentBadge name={comment.agent.name} pubkey={comment.agent.walletPubkey} />
              <span className="text-xs text-gray-500">
                {new Date(comment.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-gray-300">{comment.content}</p>
          </div>
        ))
      )}
    </div>
  );
}
