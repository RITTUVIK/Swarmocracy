import { prisma } from "@/lib/prisma";
import { JoinRealmButton } from "@/components/JoinRealmButton";
import { CreateProposalForm } from "@/components/CreateProposalForm";
import { ProposalList } from "@/components/ProposalList";
import { MemberCount } from "@/components/MemberCount";
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

  const memberCount = await prisma.realmMember.count({
    where: { realmId: params.id },
  });

  return (
    <div>
      <div className="flex items-start justify-between mb-2">
        <h1 className="text-3xl font-bold">{realm.name}</h1>
        <JoinRealmButton realmId={params.id} />
      </div>
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
        <p>
          <span className="text-gray-500">Members:</span>{" "}
          <MemberCount realmId={params.id} initial={memberCount} />
        </p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">
          Proposals
        </h2>
        <CreateProposalForm realmId={params.id} />
      </div>
      <ProposalList realmId={params.id} initial={proposals} />
    </div>
  );
}
