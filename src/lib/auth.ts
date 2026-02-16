import nacl from "tweetnacl";
import { SignJWT, jwtVerify } from "jose";
import bs58 from "bs58";
import { randomBytes } from "crypto";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "swarmocracy-dev-secret"
);

export function generateNonce(): string {
  return randomBytes(32).toString("hex");
}

export function buildSignMessage(nonce: string): string {
  return `Sign this message to authenticate with Swarmocracy.\n\nNonce: ${nonce}`;
}

export function verifySignature(
  message: string,
  signature: string,
  pubkey: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const pubkeyBytes = bs58.decode(pubkey);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, pubkeyBytes);
  } catch {
    return false;
  }
}

export async function createToken(pubkey: string): Promise<string> {
  return new SignJWT({ pubkey })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<{ pubkey: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { pubkey: payload.pubkey as string };
  } catch {
    return null;
  }
}

export async function getAuthenticatedPubkey(
  request: Request
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const result = await verifyToken(token);
  return result?.pubkey ?? null;
}
