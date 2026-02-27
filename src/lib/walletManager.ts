import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { prisma } from "./prisma";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

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
  const config = await prisma.treasuryConfig.findUnique({ where: { realmId } });
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
  const existing = await prisma.treasuryConfig.findUnique({ where: { realmId } });
  if (existing) return { walletPubkey: existing.walletPubkey };

  const keypair = Keypair.generate();
  const pubkey = keypair.publicKey.toBase58();
  const secretKeyB58 = bs58.encode(keypair.secretKey);

  // Enforce wallet separation
  const agentCollision = await prisma.agent.findUnique({ where: { walletPubkey: pubkey } });
  if (agentCollision) {
    throw new Error("SECURITY: Treasury pubkey matches an agent wallet. Wallets must be distinct.");
  }

  await prisma.treasuryConfig.create({
    data: {
      realmId,
      walletPubkey: pubkey,
      encryptedKey: encrypt(secretKeyB58),
    },
  });

  await prisma.walletRoleRecord.upsert({
    where: { publicKey: pubkey },
    create: { type: "treasury", publicKey: pubkey, authorityType: "governance_pda", ownerId: realmId },
    update: { type: "treasury", authorityType: "governance_pda", ownerId: realmId },
  });

  return { walletPubkey: pubkey };
}

/**
 * Get an agent keypair from a stored secret (base58).
 */
export function agentKeypairFromSecret(secretKeyB58: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(secretKeyB58));
}

/**
 * Register a new agent wallet's role. Called during agent onboarding.
 */
export async function registerAgentWallet(pubkey: string, agentId: string): Promise<void> {
  // Enforce: must not match any treasury wallet
  const treasuryCollision = await prisma.treasuryConfig.findFirst({
    where: { walletPubkey: pubkey },
  });
  if (treasuryCollision) {
    throw new Error("SECURITY: Agent pubkey matches a treasury wallet. Wallets must be distinct.");
  }

  await prisma.walletRoleRecord.upsert({
    where: { publicKey: pubkey },
    create: { type: "agent", publicKey: pubkey, authorityType: "ai_runtime", ownerId: agentId },
    update: { type: "agent", authorityType: "ai_runtime", ownerId: agentId },
  });
}

/**
 * Resolve the signing keypair for a given wallet role and realm.
 * OmniPair/DeFi execution MUST use treasury role — agent role is blocked.
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
