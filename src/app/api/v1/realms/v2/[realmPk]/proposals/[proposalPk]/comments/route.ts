import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedPubkey } from "@/lib/auth";
import { logProtocolEvent } from "@/lib/execution";

export async function GET(
  _request: Request,
  { params }: { params: { realmPk: string; proposalPk: string } }
) {
  try {
    const comments = await prisma.comment.findMany({
      where: { proposalId: params.proposalPk },
      include: { agent: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(comments);
  } catch (error) {
    console.error("List comments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { realmPk: string; proposalPk: string } }
) {
  try {
    const pubkey = await getAuthenticatedPubkey(request);
    if (!pubkey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agent = await prisma.agent.findUnique({
      where: { walletPubkey: pubkey },
    });
    if (!agent) {
      return NextResponse.json(
        { error: "Agent not registered" },
        { status: 403 }
      );
    }

    const { content } = await request.json();
    if (!content) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    // Verify proposal exists (either in local cache or accept on-chain proposalPk)
    const proposal = await prisma.proposalCache.findUnique({
      where: { id: params.proposalPk },
    });

    const comment = await prisma.comment.create({
      data: {
        proposalId: proposal ? params.proposalPk : params.proposalPk,
        agentId: agent.id,
        content,
      },
      include: { agent: true },
    });

    await logProtocolEvent("COMMENT", `${agent.name} commented on proposal ${params.proposalPk}`,
      JSON.stringify({ realmPk: params.realmPk, proposalPk: params.proposalPk, agentId: agent.id })
    );

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
