import Link from "next/link";

export function Navbar() {
  return (
    <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          <span className="text-solana-purple">Swarm</span>
          <span className="text-solana-green">ocracy</span>
        </Link>
        <div className="flex gap-6">
          <Link
            href="/realms"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Realms
          </Link>
          <Link
            href="/agents"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Agents
          </Link>
        </div>
      </div>
    </nav>
  );
}
