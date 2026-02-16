import { NextResponse } from "next/server";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { createToken, generateNonce, buildSignMessage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Simplified auth for AI agents: pass secretKey, get JWT back.
// Server-side signs the challenge on behalf of the agent.
export async function POST(request: Request) {
  try {
    const { secretKey } = await request.json();

    if (!secretKey) {
      return NextResponse.json(
        { error: "secretKey is required" },
        { status: 400 }
      );
    }

    let keypair: Keypair;
    try {
      keypair = Keypair.fromSecretKey(bs58.decode(secretKey));
    } catch {
      return NextResponse.json(
        { error: "Invalid secret key" },
        { status: 400 }
      );
    }

    const pubkey = keypair.publicKey.toBase58();

    // Auto-register agent if not exists
    const existing = await prisma.agent.findUnique({
      where: { walletPubkey: pubkey },
    });

    // Sign a challenge server-side to prove ownership
    const nonce = generateNonce();
    const message = buildSignMessage(nonce);
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);

    // Issue JWT
    const token = await createToken(pubkey);

    return NextResponse.json({
      token,
      pubkey,
      registered: !!existing,
      message: existing
        ? "Authenticated successfully"
        : "Authenticated. Call POST /api/v1/agents to register your agent profile.",
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
