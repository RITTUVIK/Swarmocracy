import { Connection, clusterApiUrl } from "@solana/web3.js";

const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(RPC_URL, "confirmed");
  }
  return connection;
}
