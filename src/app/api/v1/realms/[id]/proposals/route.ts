import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedPubkey } from "@/lib/auth";
import { buildCreateProposalTx, getProposalCount } from "@/lib/governance";

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

    const { name, description } = await request.json();

    if (!name || !description) {
      return NextResponse.json(
        { error: "name and description are required" },
        { status: 400 }
      );
    }

    if (realm.onChain && realm.governancePubkey) {
      // On-chain proposal: build unsigned tx for agent to sign
      const governancePk = new PublicKey(realm.governancePubkey);
      const proposalIndex = await getProposalCount(governancePk);

      const { transaction, proposalPubkey } = await buildCreateProposalTx(
        new PublicKey(pubkey),
        new PublicKey(realm.id),
        governancePk,
        new PublicKey(realm.communityMint),
        name,
        description,
        proposalIndex
      );

      return NextResponse.json(
        {
          transaction,
          proposalPubkey,
          realmId: realm.id,
          name,
          description,
          message: "Sign and submit this transaction via POST /api/v1/tx/submit",
        },
        { status: 200 }
      );
    }

    // Local-only realm: store proposal directly in DB
    const proposal = await prisma.proposalCache.create({
      data: {
        id: `proposal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        realmId: params.id,
        name,
        description,
        state: "Voting",
        createdBy: pubkey,
        onChain: false,
      },
    });

    return NextResponse.json(proposal, { status: 201 });
  } catch (error) {
    console.error("Create proposal error:", error);
    return NextResponse.json(
      { error: "Failed to create proposal" },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const proposals = await prisma.proposalCache.findMany({
      where: { realmId: params.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(proposals);
  } catch (error) {
    console.error("List proposals error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
