import { NextResponse } from "next/server";
import { Transaction } from "@solana/web3.js";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedPubkey } from "@/lib/auth";
import { getConnection } from "@/lib/solana";

type SubmitType = "deposit" | "proposal" | "vote";

interface SubmitBody {
  transaction: string; // base64-serialized signed transaction
  type: SubmitType;
  metadata: {
    // For deposit
    realmId?: string;
    tokenOwnerRecordPk?: string;
    // For proposal
    proposalPubkey?: string;
    name?: string;
    description?: string;
    governancePubkey?: string;
    // For vote
    proposalId?: string;
    vote?: string;
    voteRecordPk?: string;
  };
}

export async function POST(request: Request) {
  try {
    const pubkey = await getAuthenticatedPubkey(request);
    if (!pubkey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: SubmitBody = await request.json();
    const { transaction: txBase64, type, metadata } = body;

    if (!txBase64 || !type) {
      return NextResponse.json(
        { error: "transaction and type are required" },
        { status: 400 }
      );
    }

    if (!["deposit", "proposal", "vote"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'deposit', 'proposal', or 'vote'" },
        { status: 400 }
      );
    }

    // Deserialize and submit the signed transaction
    const connection = getConnection();
    const txBuffer = Buffer.from(txBase64, "base64");
    const tx = Transaction.from(txBuffer);

    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature);

    // Cache result in DB based on type
    if (type === "proposal" && metadata?.proposalPubkey) {
      await prisma.proposalCache.create({
        data: {
          id: metadata.proposalPubkey,
          realmId: metadata.realmId || "",
          name: metadata.name || "Untitled Proposal",
          description: metadata.description || "",
          state: "Voting",
          createdBy: pubkey,
          governancePubkey: metadata.governancePubkey || null,
          tokenOwnerRecordPk: null,
          onChain: true,
        },
      });
    } else if (type === "vote" && metadata?.proposalId && metadata?.vote) {
      await prisma.vote.upsert({
        where: {
          proposalId_voterPubkey: {
            proposalId: metadata.proposalId,
            voterPubkey: pubkey,
          },
        },
        update: {
          vote: metadata.vote,
          txSignature: signature,
          onChain: true,
        },
        create: {
          proposalId: metadata.proposalId,
          voterPubkey: pubkey,
          vote: metadata.vote,
          txSignature: signature,
          onChain: true,
        },
      });
    }
    // deposit type: no additional DB caching needed (token owner record is on-chain)

    return NextResponse.json({
      signature,
      success: true,
      type,
    });
  } catch (error) {
    console.error("Submit transaction error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to submit transaction";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
