import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedPubkey } from "@/lib/auth";
import { mintGovernanceTokens, buildDepositTx } from "@/lib/governance";
import { keypairFromSecret } from "@/lib/wallet";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const pubkey = await getAuthenticatedPubkey(request);
    if (!pubkey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const realm = await prisma.realmCache.findUnique({
      where: { id: params.id },
    });

    if (!realm) {
      return NextResponse.json({ error: "Realm not found" }, { status: 404 });
    }

    if (!realm.onChain) {
      // Local realm — just acknowledge join, no on-chain action needed
      return NextResponse.json({ message: "Joined local realm" });
    }

    // On-chain realm: authority mints token, then build unsigned deposit tx for agent
    const authoritySecret = process.env.MOLTDAO_AUTHORITY_SECRET;
    if (!authoritySecret) {
      return NextResponse.json(
        { error: "Realm authority key not configured on server" },
        { status: 500 }
      );
    }

    const authorityKeypair = keypairFromSecret(authoritySecret);

    // Server-side: mint 1 governance token to the joining agent
    const mintSignature = await mintGovernanceTokens(
      authorityKeypair,
      new PublicKey(realm.communityMint),
      new PublicKey(pubkey),
      1
    );

    // Build unsigned deposit tx for the agent to sign
    const { transaction, tokenOwnerRecordPk } = await buildDepositTx(
      new PublicKey(realm.id),
      new PublicKey(realm.communityMint),
      new PublicKey(pubkey)
    );

    return NextResponse.json({
      mintSignature,
      depositTransaction: transaction,
      tokenOwnerRecordPk,
      message: "Token minted. Sign and submit the deposit transaction.",
    });
  } catch (error) {
    console.error("Join realm error:", error);
    return NextResponse.json({ error: "Failed to join realm" }, { status: 500 });
  }
}
