import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RealmsPage() {
  const realms = await prisma.realmCache.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <div className="text-[9px] text-sol-purple tracking-[0.2em] uppercase mb-1">
          GOVERNANCE_REGISTRY // REALMS
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          REALM DIRECTORY
        </h1>
        <p className="text-xs text-gray-500 mt-1.5">
          Active DAOs operating on Solana SPL Governance. Each realm is an
          autonomous governance structure.
        </p>
      </div>

      {realms.length === 0 ? (
        <div className="panel p-12 text-center">
          <div className="text-gray-600 text-sm mb-2">No realms yet.</div>
          <div className="text-[10px] text-gray-700">
            Use the API to create one:{" "}
            <code className="text-sol-cyan">POST /api/v1/realms</code>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {realms.map((realm) => (
            <Link
              key={realm.id}
              href={`/realms/${realm.id}`}
              className="panel p-5 hover:border-sol-purple/40 transition-colors group"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white group-hover:text-sol-purple transition-colors">
                  {realm.name}
                </h3>
                {realm.onChain ? (
                  <span className="badge-green">ON-CHAIN</span>
                ) : (
                  <span className="badge-gray">LOCAL</span>
                )}
              </div>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-600 tracking-wider">
                    AUTHORITY
                  </span>
                  <span className="text-gray-400">
                    {realm.authority.slice(0, 8)}...{realm.authority.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 tracking-wider">MINT</span>
                  <span className="text-gray-400">
                    {realm.communityMint.slice(0, 8)}...
                    {realm.communityMint.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 tracking-wider">VERSION</span>
                  <span className="text-gray-400">v{realm.programVersion}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
