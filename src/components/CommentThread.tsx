"use client";

import { useState, useEffect } from "react";
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
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/realms/${realmId}/proposals/${proposalId}/comments`)
      .then((res) => res.json())
      .then((data) => {
        setComments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [realmId, proposalId]);

  if (loading) {
    return <p className="text-gray-500">Loading comments...</p>;
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold">
        Discussion ({comments.length})
      </h4>
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
