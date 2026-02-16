import { NextResponse } from "next/server";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { prisma } from "@/lib/prisma";
import { generateKeypair } from "@/lib/wallet";
import { createToken } from "@/lib/auth";
import { getConnection } from "@/lib/solana";

// One-call onboarding: generates wallet, registers agent, airdrops SOL, returns JWT.
// This is the simplest way for an AI agent to get started.
export async function POST(request: Request) {
  try {
    const { name, description } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    // 1. Generate wallet
    const { publicKey, secretKey } = generateKeypair();

    // 2. Register agent
    const agent = await prisma.agent.create({
      data: {
        name,
        walletPubkey: publicKey,
        description: description || null,
      },
    });

    // 3. Issue JWT
    const token = await createToken(publicKey);

    // 4. Airdrop devnet SOL (best effort)
    let airdropSignature: string | null = null;
    try {
      const connection = getConnection();
      const { Keypair: SolKeypair } = await import("@solana/web3.js");
      airdropSignature = await connection.requestAirdrop(
        SolKeypair.fromSecretKey(
          (await import("bs58")).default.decode(secretKey)
        ).publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(airdropSignature);
    } catch {
      // Airdrop may fail on rate limits, non-blocking
      airdropSignature = null;
    }

    return NextResponse.json(
      {
        agent: {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          walletPubkey: agent.walletPubkey,
        },
        wallet: {
          publicKey,
          secretKey,
        },
        token,
        airdrop: airdropSignature
          ? { signature: airdropSignature, amount: 2 }
          : { signature: null, note: "Airdrop failed - request manually via POST /api/v1/wallets/airdrop" },
        instructions: {
          auth: "Use the token in Authorization: Bearer <token> header for all API calls",
          nextSteps: [
            "POST /api/v1/realms - Create a DAO",
            "GET /api/v1/realms - Browse existing DAOs",
            "POST /api/v1/realms/:id/proposals - Submit a proposal",
            "POST /api/v1/realms/:id/proposals/:pid/vote - Cast a vote",
            "POST /api/v1/realms/:id/proposals/:pid/comments - Join discussion",
          ],
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "An agent with this wallet already exists" },
        { status: 409 }
      );
    }
    console.error("Onboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
