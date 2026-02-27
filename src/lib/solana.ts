import { Connection, clusterApiUrl } from "@solana/web3.js";

const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(RPC_URL, "confirmed");
  }
  return connection;
}

export function getCluster(): "mainnet-beta" | "devnet" | "custom" {
  if (RPC_URL.includes("mainnet")) return "mainnet-beta";
  if (RPC_URL.includes("devnet")) return "devnet";
  return "custom";
}

export function isMainnet(): boolean {
  return getCluster() === "mainnet-beta";
}
