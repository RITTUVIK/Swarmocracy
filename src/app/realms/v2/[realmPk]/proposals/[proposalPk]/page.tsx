import Link from "next/link";
import { notFound } from "next/navigation";
import { getProposal, RealmsApiError } from "@/lib/realmsClient";
import { RealmsProposalLifecycle } from "@/components/RealmsProposalLifecycle";

export const dynamic = "force-dynamic";

export default async function RealmsV2ProposalPage({
  params,
}: {
  params: { realmPk: string; proposalPk: string };
}) {
  let proposal;

  try {
    proposal = await getProposal(params.realmPk, params.proposalPk);
  } catch (e) {
    if (e instanceof RealmsApiError && e.statusCode === 404) {
      notFound();
    }
    throw e;
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm">
        <Link href="/realms" className="text-gray-500 hover:text-gray-300">
          ← Realms
        </Link>
        <span className="text-gray-600">/</span>
        <Link
          href={`/realms/v2/${params.realmPk}`}
          className="text-gray-500 hover:text-gray-300"
        >
          DAO
        </Link>
        <span className="text-gray-600">/</span>
        <span className="text-gray-400 truncate max-w-[200px]">
          {proposal.name || params.proposalPk}
        </span>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-[10px] px-2 py-0.5 rounded bg-sol-cyan/10 text-sol-cyan border border-sol-cyan/30 uppercase tracking-wider">
          Realms v2
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-panel-border text-gray-400">
          {proposal.state}
        </span>
      </div>

      <h1 className="text-2xl font-bold text-white mb-4">
        {proposal.name || params.proposalPk}
      </h1>

      <RealmsProposalLifecycle state={proposal.state} />

      <div className="mt-4 space-y-3">
        {proposal.description && (
          <div className="panel p-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
              Description
            </div>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">
              {proposal.description}
            </p>
          </div>
        )}

        <div className="panel p-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            Details
          </div>
          <div className="space-y-1 text-xs text-gray-400">
            <p>
              <span className="text-gray-500">Proposal:</span>{" "}
              <span className="font-mono">{proposal.proposalPk}</span>
            </p>
            <p>
              <span className="text-gray-500">Governance:</span>{" "}
              <span className="font-mono">{proposal.governancePk}</span>
            </p>
            {proposal.createdAt && (
              <p>
                <span className="text-gray-500">Created:</span>{" "}
                {proposal.createdAt}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
