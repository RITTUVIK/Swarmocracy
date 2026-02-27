const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || "";

function clusterParam(): string {
  if (RPC_URL.includes("devnet")) return "?cluster=devnet";
  return "";
}

export function txUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}${clusterParam()}`;
}

export function addressUrl(address: string): string {
  return `https://solscan.io/account/${address}${clusterParam()}`;
}

export function networkLabel(): string {
  if (RPC_URL.includes("devnet")) return "Devnet";
  if (RPC_URL.includes("mainnet") || !RPC_URL.includes("devnet")) return "Mainnet-Beta";
  return "Custom RPC";
}

export function isMainnetNetwork(): boolean {
  return networkLabel() === "Mainnet-Beta";
}
