import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const proposals = await prisma.proposalCache.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { votes: true },
    });

    const result = proposals.map((p) => {
      const yes = p.votes.filter((v) => v.vote === "yes").length;
      const no = p.votes.filter((v) => v.vote === "no").length;
      return {
        id: p.id,
        realmId: p.realmId,
        name: p.name,
        state: p.state,
        proposalType: p.proposalType,
        yesVotes: yes,
        noVotes: no,
        totalVotes: p.votes.length,
        executionStatus: p.executionStatus,
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}
