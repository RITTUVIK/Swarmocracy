import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedPubkey } from "@/lib/auth";
import { buildCastVoteTx } from "@/lib/governance";

export async function POST(
  request: Request,
  { params }: { params: { id: string; pid: string } }
) {
  try {
    const pubkey = await getAuthenticatedPubkey(request);
    if (!pubkey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const proposal = await prisma.proposalCache.findUnique({
      where: { id: params.pid },
    });

    if (!proposal || proposal.realmId !== params.id) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    const { vote } = await request.json();

    if (!["yes", "no", "abstain"].includes(vote)) {
      return NextResponse.json(
        { error: "vote must be 'yes', 'no', or 'abstain'" },
        { status: 400 }
      );
    }

    if (proposal.onChain && proposal.governancePubkey) {
      // On-chain proposal: build unsigned cast-vote tx
      const realm = await prisma.realmCache.findUnique({
        where: { id: params.id },
      });

      if (!realm) {
        return NextResponse.json({ error: "Realm not found" }, { status: 404 });
      }

      const { transaction, voteRecordPk } = await buildCastVoteTx(
        new PublicKey(pubkey),
        new PublicKey(realm.id),
        new PublicKey(proposal.governancePubkey),
        new PublicKey(proposal.id),
        new PublicKey(proposal.createdBy),
        new PublicKey(realm.communityMint),
        vote
      );

      return NextResponse.json({
        transaction,
        voteRecordPk,
        proposalId: proposal.id,
        vote,
        message: "Sign and submit this transaction via POST /api/v1/tx/submit",
      });
    }

    // Local proposal: write vote directly to DB
    const dbVote = await prisma.vote.upsert({
      where: {
        proposalId_voterPubkey: {
          proposalId: params.pid,
          voterPubkey: pubkey,
        },
      },
      update: { vote },
      create: {
        proposalId: params.pid,
        voterPubkey: pubkey,
        vote,
        onChain: false,
      },
    });

    const { logProtocolEvent } = await import("@/lib/execution");
    await logProtocolEvent(
      "AGENT_VOTE",
      `${pubkey.slice(0, 8)}... voted ${vote.toUpperCase()} on ${params.pid.slice(0, 8)}...`
    );

    // Tally from DB
    const votes = await prisma.vote.findMany({
      where: { proposalId: params.pid },
    });

    const tally = { yes: 0, no: 0, abstain: 0 };
    for (const v of votes) {
      tally[v.vote as keyof typeof tally]++;
    }

    // Auto-finalize: check if threshold reached (>=3 votes and >60% yes)
    const totalVotes = votes.length;
    if (totalVotes >= 3 && proposal.state === "Voting") {
      const yesPct = (tally.yes / totalVotes) * 100;
      if (yesPct >= 60) {
        await prisma.proposalCache.update({
          where: { id: params.pid },
          data: { state: "Succeeded" },
        });
        await logProtocolEvent(
          "TX_CONFIRM",
          `Proposal ${params.pid.slice(0, 8)}... passed with ${yesPct.toFixed(0)}% approval`
        );
      } else if (((tally.no / totalVotes) * 100) > 40) {
        await prisma.proposalCache.update({
          where: { id: params.pid },
          data: { state: "Defeated" },
        });
        await logProtocolEvent(
          "TX_CONFIRM",
          `Proposal ${params.pid.slice(0, 8)}... defeated with ${yesPct.toFixed(0)}% approval`
        );
      }
    }

    return NextResponse.json({
      message: "Vote recorded",
      vote: dbVote.vote,
      voter: pubkey,
      tally,
    });
  } catch (error) {
    console.error("Vote error:", error);
    return NextResponse.json({ error: "Failed to record vote" }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string; pid: string } }
) {
  try {
    const proposal = await prisma.proposalCache.findUnique({
      where: { id: params.pid },
    });

    if (!proposal || proposal.realmId !== params.id) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    const votes = await prisma.vote.findMany({
      where: { proposalId: params.pid },
      orderBy: { createdAt: "desc" },
    });

    const tally = { yes: 0, no: 0, abstain: 0 };
    for (const v of votes) {
      tally[v.vote as keyof typeof tally]++;
    }

    return NextResponse.json({
      proposalId: params.pid,
      tally,
      totalVotes: votes.length,
      votes: votes.map((v) => ({
        voter: v.voterPubkey,
        vote: v.vote,
        onChain: v.onChain,
        txSignature: v.txSignature,
        createdAt: v.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get votes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
