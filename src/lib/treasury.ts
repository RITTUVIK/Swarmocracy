import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { prisma } from "./prisma";
import { getConnection } from "./solana";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ENCRYPTION_KEY = process.env.TREASURY_ENCRYPTION_KEY || "swarmocracy-treasury-key-change-me";

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

/**
 * Initialize a governance-controlled treasury wallet for a DAO.
 * Enforces separation: treasury pubkey must NEVER match any agent pubkey.
 */
export async function initializeTreasury(realmId: string) {
  const existing = await prisma.treasuryConfig.findUnique({ where: { realmId } });
  if (existing) {
    return { walletPubkey: existing.walletPubkey, realmId: existing.realmId };
  }

  const keypair = Keypair.generate();
  const pubkey = keypair.publicKey.toBase58();
  const secretKeyB58 = bs58.encode(keypair.secretKey);

  // Enforce wallet separation: reject if pubkey collides with an agent wallet
  const agentCollision = await prisma.agent.findUnique({ where: { walletPubkey: pubkey } });
  if (agentCollision) {
    throw new Error(
      "SECURITY: Generated treasury pubkey matches an existing agent wallet. " +
      "Treasury and agent wallets must be distinct. Retry initialization."
    );
  }

  await prisma.treasuryConfig.create({
    data: {
      realmId,
      walletPubkey: pubkey,
      encryptedKey: encrypt(secretKeyB58),
    },
  });

  // Register wallet role for traceability
  await prisma.walletRoleRecord.upsert({
    where: { publicKey: pubkey },
    create: { type: "treasury", publicKey: pubkey, authorityType: "governance_pda", ownerId: realmId },
    update: { type: "treasury", authorityType: "governance_pda", ownerId: realmId },
  });

  return { walletPubkey: pubkey, realmId };
}

export async function getTreasuryKeypair(realmId: string): Promise<Keypair | null> {
  const config = await prisma.treasuryConfig.findUnique({ where: { realmId } });
  if (!config) return null;
  const secretKeyB58 = decrypt(config.encryptedKey);
  return Keypair.fromSecretKey(bs58.decode(secretKeyB58));
}

export async function getTreasuryInfo(realmId?: string) {
  const where = realmId ? { realmId } : {};
  const config = await prisma.treasuryConfig.findFirst({ where });
  if (!config) return null;

  const connection = getConnection();
  let balanceSol = 0;
  try {
    const balance = await connection.getBalance(
      new (await import("@solana/web3.js")).PublicKey(config.walletPubkey)
    );
    balanceSol = balance / LAMPORTS_PER_SOL;
  } catch {}

  return {
    walletPubkey: config.walletPubkey,
    balanceSol,
    realmId: config.realmId,
  };
}

/**
 * Verify that a given public key is registered as a treasury wallet,
 * NOT an agent wallet. Returns false if it's an agent key.
 */
export async function isTreasuryWallet(pubkey: string): Promise<boolean> {
  const role = await prisma.walletRoleRecord.findUnique({ where: { publicKey: pubkey } });
  return role?.type === "treasury";
}
