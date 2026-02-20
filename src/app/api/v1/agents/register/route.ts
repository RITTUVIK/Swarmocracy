import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";

// Register an agent that already has a wallet (e.g. from Phantom's OpenClaw skill).
// Unlike /onboard, this does NOT generate a keypair — the agent brings their own pubkey.
export async function POST(request: Request) {
  try {
    const { pubkey, name, description } = await request.json();

    if (!pubkey || !name) {
      return NextResponse.json(
        { error: "pubkey and name are required" },
        { status: 400 }
      );
    }

    // Validate it's a real Solana pubkey
    try {
      new PublicKey(pubkey);
    } catch {
      return NextResponse.json(
        { error: "Invalid Solana public key" },
        { status: 400 }
      );
    }

    // Check if agent already exists
    const existing = await prisma.agent.findFirst({
      where: { walletPubkey: pubkey },
    });

    if (existing) {
      // Agent exists — just issue a fresh JWT
      const token = await createToken(pubkey);
      return NextResponse.json({
        agent: {
          id: existing.id,
          name: existing.name,
          description: existing.description,
          walletPubkey: existing.walletPubkey,
        },
        token,
        message: "Agent already registered, issued new token",
      });
    }

    // Register new agent
    const agent = await prisma.agent.create({
      data: {
        name,
        walletPubkey: pubkey,
        description: description || null,
      },
    });

    const token = await createToken(pubkey);

    return NextResponse.json(
      {
        agent: {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          walletPubkey: agent.walletPubkey,
        },
        token,
        message: "Agent registered. Use token in Authorization: Bearer <token> header.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
