import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { prisma } from "./prisma";

const ENCRYPTION_KEY =
  process.env.TREASURY_ENCRYPTION_KEY || "swarmocracy-treasury-key-change-me";

function deriveKey(): Buffer {
  return scryptSync(ENCRYPTION_KEY, "swarmocracy-salt", 32);
}

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", deriveKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(data: string): string {
  const [ivHex, encrypted] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", deriveKey(), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export type WalletRole = "agent" | "treasury" | "delegated";

/**
 * Get the treasury keypair for a given realm.
 */
export async function getTreasuryKeypair(realmId: string): Promise<Keypair | null> {
  const config = await prisma.treasuryConfig.findUnique({
    where: { realmId },
  });
  if (!config) return null;
  const secretKeyB58 = decrypt(config.encryptedKey);
  return Keypair.fromSecretKey(bs58.decode(secretKeyB58));
}

/**
 * Initialize (create) a treasury wallet for a realm.
 * Returns the public key. The private key is encrypted in the DB.
 */
export async function initializeTreasuryWallet(
  realmId: string
): Promise<{ walletPubkey: string }> {
  const existing = await prisma.treasuryConfig.findUnique({
    where: { realmId },
  });
  if (existing) return { walletPubkey: existing.walletPubkey };

  const keypair = Keypair.generate();
  const secretKeyB58 = bs58.encode(keypair.secretKey);

  await prisma.treasuryConfig.create({
    data: {
      realmId,
      walletPubkey: keypair.publicKey.toBase58(),
      encryptedKey: encrypt(secretKeyB58),
    },
  });

  return { walletPubkey: keypair.publicKey.toBase58() };
}

/**
 * Get an agent keypair from a stored secret (base58).
 * Agent keys may be passed directly or stored in session; this helper decodes them.
 */
export function agentKeypairFromSecret(secretKeyB58: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(secretKeyB58));
}

/**
 * Resolve the signing keypair for a given wallet role and realm.
 */
export async function resolveKeypair(
  role: WalletRole,
  realmId: string,
  agentSecretKey?: string
): Promise<Keypair> {
  switch (role) {
    case "treasury": {
      const kp = await getTreasuryKeypair(realmId);
      if (!kp) throw new Error(`No treasury wallet for realm ${realmId}`);
      return kp;
    }
    case "agent": {
      if (!agentSecretKey) throw new Error("Agent secret key required");
      return agentKeypairFromSecret(agentSecretKey);
    }
    case "delegated": {
      if (!agentSecretKey) throw new Error("Delegated key required");
      return agentKeypairFromSecret(agentSecretKey);
    }
    default:
      throw new Error(`Unknown wallet role: ${role}`);
  }
}
