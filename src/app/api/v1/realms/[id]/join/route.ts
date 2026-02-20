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

    // Look up the agent
    const agent = await prisma.agent.findFirst({
      where: { walletPubkey: pubkey },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found. Onboard first." }, { status: 400 });
    }

    // Track membership (upsert to avoid duplicates)
    await prisma.realmMember.upsert({
      where: {
        realmId_pubkey: {
          realmId: params.id,
          pubkey,
        },
      },
      update: {},
      create: {
        realmId: params.id,
        agentId: agent.id,
        pubkey,
      },
    });

    if (!realm.onChain) {
      return NextResponse.json({ message: "Joined realm", realmId: params.id, member: pubkey });
    }

    // On-chain realm: authority mints token, then build unsigned deposit tx for agent
    const authoritySecret = realm.authoritySecret || process.env.MOLTDAO_AUTHORITY_SECRET;
    if (!authoritySecret) {
      return NextResponse.json(
        { error: "Realm authority key not configured. Import the realm with authoritySecret or set MOLTDAO_AUTHORITY_SECRET." },
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
