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

export async function initializeTreasury(realmId: string) {
  const existing = await prisma.treasuryConfig.findUnique({
    where: { realmId },
  });
  if (existing) {
    return {
      walletPubkey: existing.walletPubkey,
      realmId: existing.realmId,
    };
  }

  const keypair = Keypair.generate();
  const secretKeyB58 = bs58.encode(keypair.secretKey);

  await prisma.treasuryConfig.create({
    data: {
      realmId,
      walletPubkey: keypair.publicKey.toBase58(),
      encryptedKey: encrypt(secretKeyB58),
    },
  });

  return {
    walletPubkey: keypair.publicKey.toBase58(),
    realmId,
  };
}

export async function getTreasuryKeypair(realmId: string): Promise<Keypair | null> {
  const config = await prisma.treasuryConfig.findUnique({
    where: { realmId },
  });
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
