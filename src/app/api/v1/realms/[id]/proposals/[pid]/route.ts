import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { id: string; pid: string } }
) {
  try {
    const proposal = await prisma.proposalCache.findUnique({
      where: { id: params.pid },
      include: {
        comments: {
          include: { agent: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!proposal || proposal.realmId !== params.id) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(proposal);
  } catch (error) {
    console.error("Get proposal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
