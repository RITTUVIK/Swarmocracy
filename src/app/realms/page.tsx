import { prisma } from "@/lib/prisma";
import { RealmCard } from "@/components/RealmCard";

export const dynamic = "force-dynamic";

export default async function RealmsPage() {
  const realms = await prisma.realmCache.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Realms</h1>
      {realms.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No realms yet.</p>
          <p className="text-sm">
            Use the API to create one:{" "}
            <code className="bg-gray-800 px-2 py-1 rounded">
              POST /api/v1/realms
            </code>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {realms.map((realm) => (
            <RealmCard
              key={realm.id}
              id={realm.id}
              name={realm.name}
              authority={realm.authority}
              communityMint={realm.communityMint}
            />
          ))}
        </div>
      )}
    </div>
  );
}
