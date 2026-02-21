import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { VotePanel } from "@/components/VotePanel";
import { CommentThread } from "@/components/CommentThread";
import { ExecutionPanel } from "@/components/ExecutionPanel";
import { RealmsProposalLifecycle } from "@/components/RealmsProposalLifecycle";
import { MultiTxWarning } from "@/components/MultiTxWarning";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
}: {
  params: { id: string; pid: string };
}) {
  const proposal = await prisma.proposalCache.findUnique({
    where: { id: params.pid },
    include: { executionLogs: { orderBy: { createdAt: "desc" } } },
  });
  if (!proposal || proposal.realmId !== params.id) notFound();

  const realm = await prisma.realmCache.findUnique({
    where: { id: params.id },
  });

  let execParams: Record<string, string> | null = null;
  try {
    if (proposal.executionParams) execParams = JSON.parse(proposal.executionParams);
  } catch {}

  return (
    <div className="max-w-3xl">
      <Link
        href={`/realms/${params.id}`}
        className="text-sm text-gray-500 hover:text-white transition-colors"
      >
        &larr; Back to {realm?.name ?? "Realm"}
      </Link>

      <h1 className="text-2xl font-bold mt-4 mb-2">{proposal.name}</h1>
      <div className="flex items-center flex-wrap gap-3 text-xs text-gray-500 mb-6">
        <span>
          By {proposal.createdBy.slice(0, 8)}...{proposal.createdBy.slice(-4)}
        </span>
        <span>&middot;</span>
        <span>{new Date(proposal.createdAt).toLocaleDateString()}</span>
        <span>&middot;</span>
        <span
          className={`px-2 py-0.5 rounded ${
            proposal.state === "Voting"
              ? "bg-yellow-500/10 text-yellow-400"
              : proposal.state === "Succeeded"
                ? "bg-green-500/10 text-green-400"
                : proposal.state === "Defeated"
                  ? "bg-red-500/10 text-red-400"
                  : "bg-gray-500/10 text-gray-400"
          }`}
        >
          {proposal.state}
        </span>
        {proposal.proposalType === "omnipair_borrow" && (
          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
            Omnipair Borrow
          </span>
        )}
        {proposal.executionStatus && (
          <span
            className={`px-2 py-0.5 rounded ${
              proposal.executionStatus === "success"
                ? "bg-green-500/10 text-green-400"
                : proposal.executionStatus === "failed"
                  ? "bg-red-500/10 text-red-400"
                  : "bg-yellow-500/10 text-yellow-400"
            }`}
          >
            Exec: {proposal.executionStatus}
          </span>
        )}
      </div>

      <div className="p-4 border border-gray-800 rounded-lg mb-6">
        <h4 className="font-semibold mb-2 text-sm">Description</h4>
        <p className="text-sm text-gray-300 leading-relaxed">
          {proposal.description}
        </p>
      </div>

      <RealmsProposalLifecycle state={proposal.state} />

      {proposal.proposalType === "sowellian_bet" && (
        <MultiTxWarning
          type="Sowellian Bet"
          txCount={3}
          collateralLockRisk={true}
        />
      )}

      {execParams && (
        <div className="p-4 border border-gray-800 rounded-lg mb-6">
          <h4 className="font-semibold mb-3 text-sm">Execution Parameters</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {Object.entries(execParams).map(([k, v]) => (
              <div key={k}>
                <span className="text-gray-500 uppercase">{k}</span>
                <div className="text-gray-300 mt-0.5 break-all">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <VotePanel
          realmId={params.id}
          proposalId={params.pid}
          state={proposal.state}
        />
      </div>

      {proposal.proposalType === "omnipair_borrow" && (
        <div className="mb-6">
          <ExecutionPanel
            proposalId={params.pid}
            realmId={params.id}
            state={proposal.state}
            executionStatus={proposal.executionStatus}
            executionTxSignature={proposal.executionTxSignature}
            logs={proposal.executionLogs.map((l) => ({
              id: l.id,
              status: l.status,
              txSignature: l.txSignature,
              error: l.error,
              createdAt: l.createdAt.toISOString(),
            }))}
          />
        </div>
      )}

      {proposal.executionTxSignature && (
        <div className="p-4 border border-gray-800 rounded-lg mb-6">
          <h4 className="font-semibold mb-2 text-sm">Transaction</h4>
          <a
            href={`https://solscan.io/tx/${proposal.executionTxSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:underline break-all"
          >
            {proposal.executionTxSignature}
          </a>
        </div>
      )}

      <CommentThread realmId={params.id} proposalId={params.pid} />
    </div>
  );
}
