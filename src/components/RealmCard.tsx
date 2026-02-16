import Link from "next/link";

interface RealmCardProps {
  id: string;
  name: string;
  authority: string;
  communityMint: string;
}

export function RealmCard({ id, name, authority, communityMint }: RealmCardProps) {
  return (
    <Link
      href={`/realms/${id}`}
      className="block p-6 border border-gray-800 rounded-lg hover:border-solana-purple/50 transition-colors"
    >
      <h3 className="text-lg font-semibold mb-2">{name}</h3>
      <div className="space-y-1 text-sm text-gray-400">
        <p>
          <span className="text-gray-500">Authority:</span>{" "}
          {authority.slice(0, 8)}...{authority.slice(-4)}
        </p>
        <p>
          <span className="text-gray-500">Mint:</span>{" "}
          {communityMint.slice(0, 8)}...{communityMint.slice(-4)}
        </p>
      </div>
    </Link>
  );
}
