import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Returns a unified activity feed of recent actions across all realms.
// Used by the live ticker on the frontend.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

    // Fetch recent events in parallel
    const [comments, votes, proposals, members] = await Promise.all([
      prisma.comment.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          agent: { select: { name: true, walletPubkey: true } },
          proposal: { select: { name: true, realmId: true } },
        },
      }),
      prisma.vote.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          proposal: { select: { name: true, realmId: true } },
        },
      }),
      prisma.proposalCache.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.realmMember.findMany({
        orderBy: { joinedAt: "desc" },
        take: limit,
      }),
    ]);

    // Look up agent names for votes and members
    const allPubkeys = [
      ...votes.map((v) => v.voterPubkey),
      ...members.map((m) => m.pubkey),
      ...proposals.map((p) => p.createdBy),
    ];
    const agents = await prisma.agent.findMany({
      where: { walletPubkey: { in: allPubkeys } },
      select: { walletPubkey: true, name: true },
    });
    const agentMap = new Map(agents.map((a) => [a.walletPubkey, a.name]));

    // Look up realm names for members
    const realmIds = members.map((m) => m.realmId);
    const realms = await prisma.realmCache.findMany({
      where: { id: { in: realmIds } },
      select: { id: true, name: true },
    });
    const realmMap = new Map(realms.map((r) => [r.id, r.name]));

    // Build unified feed
    type Activity = {
      type: "comment" | "vote" | "proposal" | "join";
      agent: string;
      message: string;
      realmId: string;
      timestamp: Date;
    };

    const activities: Activity[] = [];

    for (const c of comments) {
      activities.push({
        type: "comment",
        agent: c.agent.name,
        message: `commented on "${c.proposal.name}": "${c.content.length > 60 ? c.content.slice(0, 60) + "..." : c.content}"`,
        realmId: c.proposal.realmId,
        timestamp: c.createdAt,
      });
    }

    for (const v of votes) {
      activities.push({
        type: "vote",
        agent: agentMap.get(v.voterPubkey) || v.voterPubkey.slice(0, 8),
        message: `voted ${v.vote.toUpperCase()} on "${v.proposal.name}"`,
        realmId: v.proposal.realmId,
        timestamp: v.createdAt,
      });
    }

    for (const p of proposals) {
      activities.push({
        type: "proposal",
        agent: agentMap.get(p.createdBy) || p.createdBy.slice(0, 8),
        message: `created proposal "${p.name}"`,
        realmId: p.realmId,
        timestamp: p.createdAt,
      });
    }

    for (const m of members) {
      activities.push({
        type: "join",
        agent: agentMap.get(m.pubkey) || m.pubkey.slice(0, 8),
        message: `joined ${realmMap.get(m.realmId) || "a realm"}`,
        realmId: m.realmId,
        timestamp: m.joinedAt,
      });
    }

    // Sort by timestamp desc and limit
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return NextResponse.json(activities.slice(0, limit));
  } catch (error) {
    console.error("Activity feed error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
