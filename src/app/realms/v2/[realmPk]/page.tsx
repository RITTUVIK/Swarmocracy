import Link from "next/link";
import { notFound } from "next/navigation";
import { getDAO, listProposals } from "@/lib/realmsClient";
import { RealmsTreasuryView } from "@/components/RealmsTreasuryView";
import { RealmsVotingPower } from "@/components/RealmsVotingPower";
import { RealmsApiError } from "@/lib/realmsClient";

export const dynamic = "force-dynamic";

export default async function RealmsV2DAOPage({
  params,
}: {
  params: { realmPk: string };
}) {
  let dao;
  let proposals: Awaited<ReturnType<typeof listProposals>> = [];

  try {
    dao = await getDAO(params.realmPk);
  } catch (e) {
    if (e instanceof RealmsApiError && e.statusCode === 404) {
      notFound();
    }
    throw e;
  }

  try {
    proposals = await listProposals(params.realmPk);
  } catch {
    // Proposals optional; show DAO even if proposals fail
  }

  const name = dao.name || dao.realmPk || params.realmPk;
  const authority = dao.authority;
  const communityMint = dao.communityMint;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Link
          href="/realms"
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          ← Realms
        </Link>
        <span className="text-gray-600">/</span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-sol-cyan/10 text-sol-cyan border border-sol-cyan/30 uppercase tracking-wider">
          Realms v2
        </span>
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">
        {String(name)}
      </h1>
      <div className="text-sm text-gray-400 mb-8 space-y-1">
        <p>
          <span className="text-gray-500">Realm (public key):</span>{" "}
          <span className="font-mono text-xs">{params.realmPk}</span>
        </p>
        {authority && (
          <p>
            <span className="text-gray-500">Authority:</span> {authority}
          </p>
        )}
        {communityMint && (
          <p>
            <span className="text-gray-500">Community mint:</span>{" "}
            {String(communityMint)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <RealmsVotingPower realmPk={params.realmPk} />
        <RealmsTreasuryView realmPk={params.realmPk} />
      </div>

      <h2 className="text-2xl font-semibold text-white mb-4">
        Proposals ({proposals.length})
      </h2>
      {proposals.length > 0 ? (
        <div className="space-y-2">
          {proposals.slice(0, 50).map((p) => (
            <Link
              key={p.proposalPk}
              href={`/realms/v2/${params.realmPk}/proposals/${p.proposalPk}`}
              className="panel p-4 block hover:border-sol-cyan/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white truncate flex-1 mr-3">
                  {p.name || p.proposalPk}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-panel-border text-gray-400 shrink-0">
                  {p.state}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel p-6 text-center text-gray-500 text-sm">
          No proposals found for this DAO.
        </div>
      )}
    </div>
  );
}
