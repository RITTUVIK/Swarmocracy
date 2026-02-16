import { prisma } from "@/lib/prisma";
import { ProposalCard } from "@/components/ProposalCard";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

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
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">{realm.name}</h1>
      <div className="text-sm text-gray-400 mb-8 space-y-1">
        <p>
          <span className="text-gray-500">Realm ID:</span> {realm.id}
        </p>
        <p>
          <span className="text-gray-500">Authority:</span> {realm.authority}
        </p>
        <p>
          <span className="text-gray-500">Community Mint:</span>{" "}
          {realm.communityMint}
        </p>
      </div>

      <h2 className="text-2xl font-semibold mb-4">
        Proposals ({proposals.length})
      </h2>
      {proposals.length === 0 ? (
        <p className="text-gray-500">
          No proposals yet. Use the API to create one.
        </p>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => (
            <ProposalCard
              key={p.id}
              id={p.id}
              realmId={p.realmId}
              name={p.name}
              description={p.description}
              state={p.state}
              createdBy={p.createdBy}
            />
          ))}
        </div>
      )}
    </div>
  );
}
