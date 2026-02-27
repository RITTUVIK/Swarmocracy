import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_STRATEGIES = ["general", "conservative", "growth", "alignment", "yield", "defensive"];
const VALID_THRESHOLDS = ["simple_majority", "supermajority", "unanimous"];
const VALID_FILTERS = ["all", "treasury_only", "parameter_only", "defi_only"];

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await prisma.agent.findUnique({ where: { id: params.id } });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const votes = await prisma.vote.findMany({
      where: { voterPubkey: agent.walletPubkey },
      include: { proposal: { select: { name: true, realmId: true, state: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const memberships = await prisma.realmMember.findMany({
      where: { pubkey: agent.walletPubkey },
    });

    const executionLogs = await prisma.executionLog.findMany({
      where: { proposal: { createdBy: agent.walletPubkey } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      ...agent,
      allowedDaos: agent.allowedDaos ? JSON.parse(agent.allowedDaos) : null,
      allowedMints: agent.allowedMints ? JSON.parse(agent.allowedMints) : null,
      votes,
      memberships,
      executionLogs,
    });
  } catch (error) {
    console.error("Get agent error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await prisma.agent.findUnique({ where: { id: params.id } });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const body = await request.json();
    const update: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
    if (typeof body.description === "string") update.description = body.description.trim() || null;
    if (VALID_STRATEGIES.includes(body.strategy)) update.strategy = body.strategy;
    if (VALID_THRESHOLDS.includes(body.voteThreshold)) update.voteThreshold = body.voteThreshold;
    if (VALID_FILTERS.includes(body.proposalFilter)) update.proposalFilter = body.proposalFilter;

    if (body.allowedDaos !== undefined) {
      update.allowedDaos = Array.isArray(body.allowedDaos) && body.allowedDaos.length > 0
        ? JSON.stringify(body.allowedDaos)
        : null;
    }
    if (body.allowedMints !== undefined) {
      update.allowedMints = Array.isArray(body.allowedMints) && body.allowedMints.length > 0
        ? JSON.stringify(body.allowedMints)
        : null;
    }
    if (typeof body.maxVotingPowerPct === "number") {
      update.maxVotingPowerPct = Math.max(1, Math.min(100, Math.round(body.maxVotingPowerPct)));
    }
    if (typeof body.autoVoteEnabled === "boolean") update.autoVoteEnabled = body.autoVoteEnabled;
    if (typeof body.abstainOnLowInfo === "boolean") update.abstainOnLowInfo = body.abstainOnLowInfo;
    if (typeof body.executionEnabled === "boolean") update.executionEnabled = body.executionEnabled;
    if (typeof body.requireApproval === "boolean") update.requireApproval = body.requireApproval;

    // Pause/unpause
    if (typeof body.paused === "boolean") {
      update.paused = body.paused;
      if (body.paused) {
        update.pausedAt = new Date();
        update.pausedReason = typeof body.pausedReason === "string" ? body.pausedReason : "Manually paused";
      } else {
        update.pausedAt = null;
        update.pausedReason = null;
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.agent.update({ where: { id: params.id }, data: update });

    return NextResponse.json({
      ...updated,
      allowedDaos: updated.allowedDaos ? JSON.parse(updated.allowedDaos) : null,
      allowedMints: updated.allowedMints ? JSON.parse(updated.allowedMints) : null,
    });
  } catch (error) {
    console.error("Update agent error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await prisma.agent.findUnique({ where: { id: params.id } });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    await prisma.comment.deleteMany({ where: { agentId: params.id } });
    await prisma.realmMember.deleteMany({ where: { pubkey: agent.walletPubkey } });
    await prisma.agent.delete({ where: { id: params.id } });

    try {
      const { logProtocolEvent } = await import("@/lib/execution");
      await logProtocolEvent("AGENT_LEAVE", `${agent.name} (${agent.walletPubkey.slice(0, 8)}...) removed`);
    } catch {}

    return NextResponse.json({ success: true, deleted: agent.name });
  } catch (error) {
    console.error("Delete agent error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
