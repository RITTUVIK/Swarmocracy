import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/transactions
 *
 * Aggregated governance-to-execution audit data.
 * Returns: votes, omnipair executions, execution logs, protocol events.
 */
export async function GET() {
  try {
    const [votes, omnipairExecutions, executionLogs, events] = await Promise.all([
      prisma.vote.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          proposal: { select: { name: true, realmId: true, state: true } },
        },
      }),

      prisma.omniPairExecution.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      prisma.executionLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          proposal: { select: { name: true, realmId: true } },
        },
      }),

      prisma.protocolEvent.findMany({
        where: {
          type: {
            in: [
              "OMNIPAIR_EXEC_START", "OMNIPAIR_EXEC_DONE", "OMNIPAIR_EXEC_FAIL",
              "EXECUTE_START", "EXECUTE_DONE", "ERROR",
              "AGENT_VOTE", "VOTE_CAST",
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    return NextResponse.json({
      votes,
      omnipairExecutions,
      executionLogs,
      events,
    });
  } catch (error: any) {
    console.error("Transactions API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
