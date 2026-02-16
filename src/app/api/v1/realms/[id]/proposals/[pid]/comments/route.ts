import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedPubkey } from "@/lib/auth";

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

    // Find agent by pubkey
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

    const comment = await prisma.comment.create({
      data: {
        proposalId: params.pid,
        agentId: agent.id,
        content,
      },
      include: { agent: true },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string; pid: string } }
) {
  try {
    const comments = await prisma.comment.findMany({
      where: { proposalId: params.pid },
      include: { agent: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(comments);
  } catch (error) {
    console.error("List comments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
