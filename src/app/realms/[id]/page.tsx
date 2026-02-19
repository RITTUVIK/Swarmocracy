import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const stateStyles: Record<string, string> = {
  Voting: "badge-yellow",
  Succeeded: "badge-green",
  Defeated: "badge-red",
  Completed: "badge-green",
  Draft: "badge-gray",
  Cancelled: "badge-red",
};

export default async function RealmDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const realm = await prisma.realmCache.findUnique({
    where: { id: params.id },
  });
  if (!realm) notFound();

  const proposals = await prisma.proposalCache.findMany({
    where: { realmId: params.id },
    orderBy: { createdAt: "desc" },
    include: { votes: true },
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <Link
          href="/realms"
          className="text-[10px] text-gray-600 hover:text-sol-cyan tracking-wider uppercase transition-colors"
        >
          ← BACK TO REALMS
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-white mt-2">
          {realm.name}
        </h1>
        <div className="flex items-center gap-3 mt-2">
          {realm.onChain ? (
            <span className="badge-green">ON-CHAIN</span>
          ) : (
            <span className="badge-gray">LOCAL</span>
          )}
          <span className="text-[10px] text-gray-500">
            v{realm.programVersion}
          </span>
        </div>
      </div>

      <div className="panel p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-[9px] text-gray-600 tracking-wider uppercase mb-1">
              REALM_ID
            </div>
            <div className="text-[10px] text-gray-300 break-all">
              {realm.id}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-gray-600 tracking-wider uppercase mb-1">
              AUTHORITY
            </div>
            <div className="text-[10px] text-gray-300 break-all">
              {realm.authority}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-gray-600 tracking-wider uppercase mb-1">
              COMMUNITY_MINT
            </div>
            <div className="text-[10px] text-gray-300 break-all">
              {realm.communityMint}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="panel-header flex items-center gap-2">
            <span className="text-sol-purple">◈</span> PROPOSALS (
            {proposals.length})
          </div>
        </div>
        {proposals.length === 0 ? (
          <div className="panel p-8 text-center text-gray-600 text-xs">
            No proposals yet. Use the API to create one.
          </div>
        ) : (
          <div className="space-y-2">
            {proposals.map((p) => {
              const yes = p.votes.filter((v) => v.vote === "yes").length;
              const no = p.votes.filter((v) => v.vote === "no").length;
              const total = p.votes.length;
              const pct = total > 0 ? Math.round((yes / total) * 100) : 0;
              return (
                <Link
                  key={p.id}
                  href={`/realms/${params.id}/proposals/${p.id}`}
                  className="panel p-4 block hover:border-sol-purple/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-medium text-white">
                        {p.name}
                      </h3>
                      {p.proposalType === "omnipair_borrow" && (
                        <span className="badge-cyan">OMNIPAIR_BORROW</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {p.executionStatus && (
                        <span
                          className={
                            p.executionStatus === "success"
                              ? "badge-green"
                              : p.executionStatus === "failed"
                                ? "badge-red"
                                : "badge-yellow"
                          }
                        >
                          EXEC:{p.executionStatus.toUpperCase()}
                        </span>
                      )}
                      <span className={stateStyles[p.state] ?? "badge-gray"}>
                        {p.state.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-3 line-clamp-1">
                    {p.description}
                  </p>
                  <div className="h-1 bg-panel-border rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full bg-sol-green rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-600 tracking-wider">
                    <span>{pct}% FOR</span>
                    <span>
                      {yes} YES / {no} NO / {total} TOTAL
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
