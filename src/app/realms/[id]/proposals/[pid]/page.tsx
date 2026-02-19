import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { VotePanel } from "@/components/VotePanel";
import { CommentThread } from "@/components/CommentThread";
import { ExecutionPanel } from "@/components/ExecutionPanel";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
}: {
  params: { id: string; pid: string };
}) {
  const proposal = await prisma.proposalCache.findUnique({
    where: { id: params.pid },
    include: { votes: true, executionLogs: { orderBy: { createdAt: "desc" } } },
  });
  if (!proposal || proposal.realmId !== params.id) notFound();

  const realm = await prisma.realmCache.findUnique({
    where: { id: params.id },
  });

  const yes = proposal.votes.filter((v) => v.vote === "yes").length;
  const no = proposal.votes.filter((v) => v.vote === "no").length;
  const abstain = proposal.votes.filter((v) => v.vote === "abstain").length;
  const total = proposal.votes.length;
  const pctYes = total > 0 ? Math.round((yes / total) * 100) : 0;

  let execParams: Record<string, string> | null = null;
  try {
    if (proposal.executionParams) execParams = JSON.parse(proposal.executionParams);
  } catch {}

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <Link
        href={`/realms/${params.id}`}
        className="text-[10px] text-gray-600 hover:text-sol-cyan tracking-wider uppercase transition-colors"
      >
        ← BACK TO {realm?.name?.toUpperCase() ?? "REALM"}
      </Link>

      <div>
        <div className="flex items-center gap-3 mb-2">
          <span
            className={
              proposal.state === "Voting"
                ? "badge-yellow"
                : proposal.state === "Succeeded"
                  ? "badge-green"
                  : proposal.state === "Defeated"
                    ? "badge-red"
                    : "badge-gray"
            }
          >
            {proposal.state.toUpperCase()}
          </span>
          {proposal.proposalType === "omnipair_borrow" && (
            <span className="badge-cyan">OMNIPAIR_BORROW</span>
          )}
          {proposal.executionStatus && (
            <span
              className={
                proposal.executionStatus === "success"
                  ? "badge-green"
                  : proposal.executionStatus === "failed"
                    ? "badge-red"
                    : "badge-yellow"
              }
            >
              EXEC:{proposal.executionStatus.toUpperCase()}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {proposal.name}
        </h1>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
          <span>
            BY {proposal.createdBy.slice(0, 8)}...
            {proposal.createdBy.slice(-4)}
          </span>
          <span>•</span>
          <span>{new Date(proposal.createdAt).toLocaleDateString()}</span>
          <span>•</span>
          <span>
            PROP_ID: {proposal.id.slice(0, 12)}...
          </span>
        </div>
      </div>

      <div className="panel p-4">
        <div className="panel-header mb-2">DESCRIPTION</div>
        <p className="text-xs text-gray-300 leading-relaxed">
          {proposal.description}
        </p>
      </div>

      {execParams && (
        <div className="panel p-4">
          <div className="panel-header mb-3">EXECUTION_PARAMETERS</div>
          <div className="grid grid-cols-2 gap-3 text-[10px]">
            {Object.entries(execParams).map(([k, v]) => (
              <div key={k}>
                <span className="text-gray-600 uppercase tracking-wider">
                  {k}
                </span>
                <div className="text-gray-300 mt-0.5 break-all">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vote tally */}
      <div className="panel p-4">
        <div className="panel-header mb-3">VOTE_TALLY</div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-sol-green text-xl font-bold">{yes}</div>
            <div className="text-[9px] text-gray-600 tracking-wider">YES</div>
          </div>
          <div>
            <div className="text-red-400 text-xl font-bold">{no}</div>
            <div className="text-[9px] text-gray-600 tracking-wider">NO</div>
          </div>
          <div>
            <div className="text-gray-400 text-xl font-bold">{abstain}</div>
            <div className="text-[9px] text-gray-600 tracking-wider">
              ABSTAIN
            </div>
          </div>
        </div>
        <div className="h-2 bg-panel-border rounded-full overflow-hidden flex">
          {total > 0 && (
            <>
              <div
                className="h-full bg-sol-green"
                style={{ width: `${pctYes}%` }}
              />
              <div
                className="h-full bg-red-400"
                style={{ width: `${Math.round((no / total) * 100)}%` }}
              />
            </>
          )}
        </div>
        <div className="text-[9px] text-gray-500 mt-2 tracking-wider">
          {total} TOTAL VOTES • {pctYes}% APPROVAL
        </div>
      </div>

      <VotePanel
        realmId={params.id}
        proposalId={params.pid}
        state={proposal.state}
      />

      {proposal.proposalType === "omnipair_borrow" && (
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
      )}

      {proposal.executionTxSignature && (
        <div className="panel p-4">
          <div className="panel-header mb-2">TRANSACTION_CONFIRMED</div>
          <a
            href={`https://solscan.io/tx/${proposal.executionTxSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sol-cyan hover:underline break-all"
          >
            {proposal.executionTxSignature}
          </a>
        </div>
      )}

      <CommentThread realmId={params.id} proposalId={params.pid} />
    </div>
  );
}
