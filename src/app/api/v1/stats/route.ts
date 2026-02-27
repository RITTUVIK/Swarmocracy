import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [agentCount, voteCount, proposalCount, realmCount, executionCount, omniPairCount] = await Promise.all([
      prisma.agent.count(),
      prisma.vote.count(),
      prisma.proposalCache.count(),
      prisma.realmCache.count(),
      prisma.executionLog.count(),
      prisma.omniPairExecution.count(),
    ]);

    const totalTx = voteCount + executionCount + omniPairCount;

    return NextResponse.json({
      tvl: "$0",
      agents: agentCount,
      txCount: totalTx.toString(),
      tps: "0",
      proposals: proposalCount,
      realms: realmCount,
      votes: voteCount,
      executions: executionCount,
    });
  } catch {
    return NextResponse.json(
      { tvl: "$0", agents: 0, txCount: "0", tps: "0" },
      { status: 200 }
    );
  }
}
