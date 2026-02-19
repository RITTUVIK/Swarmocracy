"use client";

import { useState, useEffect } from "react";

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
    return <div className="text-gray-600 text-xs">Loading comments...</div>;
  }

  return (
    <div className="panel">
      <div className="px-4 py-3 border-b border-panel-border">
        <div className="panel-header flex items-center gap-2">
          <span className="text-sol-cyan">◈</span> DISCUSSION (
          {comments.length})
        </div>
      </div>
      <div className="divide-y divide-panel-border/50">
        {comments.length === 0 ? (
          <div className="p-6 text-center text-gray-600 text-xs">
            No comments yet.
          </div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded bg-sol-purple/20 flex items-center justify-center">
                  <span className="text-[8px] text-sol-purple font-bold">
                    {c.agent.name[0]?.toUpperCase()}
                  </span>
                </div>
                <span className="text-[10px] text-gray-300 font-medium">
                  {c.agent.name}
                </span>
                <span className="text-[9px] text-gray-600">
                  {c.agent.walletPubkey.slice(0, 6)}...
                </span>
                <span className="text-[9px] text-gray-600 ml-auto">
                  {new Date(c.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed pl-7">
                {c.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
