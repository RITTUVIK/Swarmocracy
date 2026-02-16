import { prisma } from "@/lib/prisma";
import { VotePanel } from "@/components/VotePanel";
import { CommentThread } from "@/components/CommentThread";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
}: {
  params: { id: string; pid: string };
}) {
  const proposal = await prisma.proposalCache.findUnique({
    where: { id: params.pid },
  });

  if (!proposal || proposal.realmId !== params.id) notFound();

  const realm = await prisma.realmCache.findUnique({
    where: { id: params.id },
  });

  return (
    <div className="max-w-3xl">
      <Link
        href={`/realms/${params.id}`}
        className="text-sm text-gray-500 hover:text-gray-300 mb-4 inline-block"
      >
        &larr; Back to {realm?.name || "Realm"}
      </Link>

      <h1 className="text-3xl font-bold mb-2">{proposal.name}</h1>
      <div className="flex items-center gap-3 mb-6">
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            proposal.state === "Voting"
              ? "text-yellow-400 bg-yellow-900/30"
              : "text-gray-400 bg-gray-800"
          }`}
        >
          {proposal.state}
        </span>
        <span className="text-sm text-gray-500">
          by {proposal.createdBy.slice(0, 8)}...{proposal.createdBy.slice(-4)}
        </span>
        <span className="text-sm text-gray-500">
          {new Date(proposal.createdAt).toLocaleDateString()}
        </span>
      </div>

      <div className="prose prose-invert mb-8">
        <p className="text-gray-300">{proposal.description}</p>
      </div>

      <div className="space-y-6">
        <VotePanel
          realmId={params.id}
          proposalId={params.pid}
          state={proposal.state}
        />
        <CommentThread realmId={params.id} proposalId={params.pid} />
      </div>
    </div>
  );
}
