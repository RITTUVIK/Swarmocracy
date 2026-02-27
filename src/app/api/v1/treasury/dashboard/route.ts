import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTreasuryInfo } from "@/lib/treasury";

/**
 * GET /api/v1/treasury/dashboard
 *
 * Comprehensive treasury data for the treasury control surface.
 * Returns: summary, positions, execution metrics, timeline, balance breakdown.
 * Read-only — no execution authority.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const realmId = searchParams.get("realmId") ?? undefined;

    const info = await getTreasuryInfo(realmId);

    const [omnipairPositions, executionLogs, protocolEvents, allTreasuries] = await Promise.all([
      prisma.omniPairExecution.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),

      prisma.executionLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          proposal: { select: { name: true, realmId: true, state: true } },
        },
      }),

      prisma.protocolEvent.findMany({
        where: {
          type: {
            in: [
              "OMNIPAIR_EXEC_START", "OMNIPAIR_EXEC_DONE", "OMNIPAIR_EXEC_FAIL",
              "EXECUTE_START", "EXECUTE_DONE", "ERROR",
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      prisma.treasuryConfig.findMany({
        select: { realmId: true, walletPubkey: true, createdAt: true },
      }),
    ]);

    // Compute metrics
    const successCount = executionLogs.filter((l) => l.status === "success").length;
    const failedCount = executionLogs.filter((l) => l.status !== "success").length;
    const successRate = executionLogs.length > 0
      ? Math.round((successCount / executionLogs.length) * 100)
      : 0;

    const executedPositions = omnipairPositions.filter((p) => p.status === "executed");
    const activePositions = omnipairPositions.filter(
      (p) => p.status === "executed" && (p.executionType === "borrow" || p.executionType === "lend")
    );

    const totalDeployedVolume = executedPositions.reduce((sum, p) => {
      const amt = parseFloat(p.amount) || 0;
      return sum + amt;
    }, 0);

    // Latency: average time from createdAt to executedAt for executed positions
    const latencies = executedPositions
      .filter((p) => p.executedAt)
      .map((p) => new Date(p.executedAt!).getTime() - new Date(p.createdAt).getTime());
    const avgLatencyMs = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;

    const lastExecution = executionLogs.length > 0
      ? executionLogs[0].createdAt
      : null;

    // Build timeline grouped by proposal
    const timelineMap = new Map<string, {
      proposalId: string;
      proposalName: string;
      events: { type: string; timestamp: string; txSignature?: string | null; status?: string }[];
    }>();

    for (const log of executionLogs) {
      if (!timelineMap.has(log.proposalId)) {
        timelineMap.set(log.proposalId, {
          proposalId: log.proposalId,
          proposalName: log.proposal.name,
          events: [],
        });
      }
      timelineMap.get(log.proposalId)!.events.push({
        type: log.type,
        timestamp: log.createdAt.toISOString(),
        txSignature: log.txSignature,
        status: log.status,
      });
    }

    for (const pos of omnipairPositions) {
      if (!timelineMap.has(pos.proposalPk)) {
        timelineMap.set(pos.proposalPk, {
          proposalId: pos.proposalPk,
          proposalName: `Proposal ${pos.proposalPk.slice(0, 8)}...`,
          events: [],
        });
      }
      timelineMap.get(pos.proposalPk)!.events.push({
        type: `omnipair_${pos.executionType}`,
        timestamp: (pos.executedAt ?? pos.createdAt).toISOString(),
        txSignature: pos.txSignature,
        status: pos.status,
      });
    }

    // Sort each group's events chronologically
    const timelineGroups = Array.from(timelineMap.values());
    for (const group of timelineGroups) {
      group.events.sort((a: { timestamp: string }, b: { timestamp: string }) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }

    return NextResponse.json({
      treasury: info
        ? {
            walletPubkey: info.walletPubkey,
            balanceSol: info.balanceSol,
            realmId: info.realmId,
          }
        : null,
      allTreasuries,

      summary: {
        totalBalanceSol: info?.balanceSol ?? 0,
        totalDeployedVolume,
        activePositionsCount: activePositions.length,
        availableLiquidity: (info?.balanceSol ?? 0),
      },

      positions: omnipairPositions.map((p) => ({
        id: p.id,
        daoPk: p.daoPk,
        proposalPk: p.proposalPk,
        executionType: p.executionType,
        assetMint: p.assetMint,
        collateralMint: p.collateralMint,
        amount: p.amount,
        status: p.status,
        txSignature: p.txSignature,
        treasuryPk: p.treasuryPk,
        executedBy: p.executedBy,
        errorMessage: p.errorMessage,
        createdAt: p.createdAt,
        executedAt: p.executedAt,
      })),

      metrics: {
        successCount,
        failedCount,
        successRate,
        totalExecutedVolume: totalDeployedVolume,
        avgLatencyMs,
        lastExecution,
      },

      timeline: timelineGroups,
      executionLogs,
      events: protocolEvents,

      risk: {
        capitalDeployedPct: (info?.balanceSol ?? 0) > 0
          ? Math.round((totalDeployedVolume / ((info?.balanceSol ?? 0) + totalDeployedVolume)) * 100)
          : 0,
        capitalIdlePct: (info?.balanceSol ?? 0) > 0
          ? Math.round(((info?.balanceSol ?? 0) / ((info?.balanceSol ?? 0) + totalDeployedVolume)) * 100)
          : 100,
        activeBorrowCount: activePositions.filter((p) => p.executionType === "borrow").length,
        activeLendCount: activePositions.filter((p) => p.executionType === "lend").length,
      },
    });
  } catch (error: any) {
    console.error("Treasury dashboard error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
