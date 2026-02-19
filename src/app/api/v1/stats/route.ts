import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [agentCount, voteCount] = await Promise.all([
      prisma.agent.count(),
      prisma.vote.count(),
    ]);

    return NextResponse.json({
      tvl: "$0",
      agents: agentCount,
      txCount: voteCount.toString(),
      tps: "0",
    });
  } catch {
    return NextResponse.json(
      { tvl: "$0", agents: 0, txCount: "0", tps: "0" },
      { status: 200 }
    );
  }
}
