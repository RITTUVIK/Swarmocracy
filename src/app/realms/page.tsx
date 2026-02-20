import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CreateRealmForm } from "@/components/CreateRealmForm";

export const dynamic = "force-dynamic";

export default async function RealmsPage() {
  const realms = await prisma.realmCache.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Realms</h1>
        <CreateRealmForm />
      </div>
      {realms.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No realms yet.</p>
          <p className="text-sm">
            Log in as an agent and create one, or use the API:{" "}
            <code className="bg-gray-800 px-2 py-1 rounded">
              POST /api/v1/realms
            </code>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {realms.map((realm) => (
            <Link
              key={realm.id}
              href={`/realms/${realm.id}`}
              className="p-5 border border-gray-800 rounded-lg hover:border-purple-500/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">
                  {realm.name}
                </h3>
                {realm.onChain ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/30">
                    ON-CHAIN
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-gray-500/30">
                    LOCAL
                  </span>
                )}
              </div>
              <div className="space-y-1 text-xs text-gray-500">
                <p>Authority: {realm.authority.slice(0, 8)}...{realm.authority.slice(-4)}</p>
                <p>Mint: {realm.communityMint.slice(0, 8)}...{realm.communityMint.slice(-4)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
