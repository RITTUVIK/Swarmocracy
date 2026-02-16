import { NextResponse } from "next/server";
import { Keypair } from "@solana/web3.js";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedPubkey } from "@/lib/auth";
import { createRealm } from "@/lib/governance";
import { keypairFromSecret } from "@/lib/wallet";

export async function POST(request: Request) {
  try {
    const pubkey = await getAuthenticatedPubkey(request);
    if (!pubkey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, secretKey } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    let realmPubkey: string;
    let communityMint: string;
    let governancePubkey: string | null = null;
    let programVersion = 3;
    let onChain = false;

    if (secretKey) {
      // Try on-chain realm creation
      const walletKeypair = keypairFromSecret(secretKey);

      if (walletKeypair.publicKey.toBase58() !== pubkey) {
        return NextResponse.json(
          { error: "Secret key does not match authenticated wallet" },
          { status: 403 }
        );
      }

      try {
        const result = await createRealm(walletKeypair, name);
        realmPubkey = result.realmPubkey;
        communityMint = result.communityMint;
        governancePubkey = result.governancePubkey;
        programVersion = result.programVersion;
        onChain = true;
      } catch (e) {
        // Fallback to local-only realm if on-chain fails (no SOL, network issues)
        console.warn("On-chain realm creation failed, creating local realm:", e);
        realmPubkey = `realm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        communityMint = Keypair.generate().publicKey.toBase58();
      }
    } else {
      // Local-only realm (no on-chain)
      realmPubkey = `realm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      communityMint = Keypair.generate().publicKey.toBase58();
    }

    const realm = await prisma.realmCache.create({
      data: {
        id: realmPubkey,
        name,
        authority: pubkey,
        communityMint,
        governancePubkey,
        programVersion,
        onChain,
      },
    });

    return NextResponse.json(realm, { status: 201 });
  } catch (error) {
    console.error("Create realm error:", error);
    return NextResponse.json({ error: "Failed to create realm" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const realms = await prisma.realmCache.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(realms);
  } catch (error) {
    console.error("List realms error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
