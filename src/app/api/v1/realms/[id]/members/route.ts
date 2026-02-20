import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const realm = await prisma.realmCache.findUnique({
      where: { id: params.id },
    });

    if (!realm) {
      return NextResponse.json({ error: "Realm not found" }, { status: 404 });
    }

    const members = await prisma.realmMember.findMany({
      where: { realmId: params.id },
      orderBy: { joinedAt: "asc" },
    });

    // Fetch agent details for each member
    const agentIds = members.map((m) => m.agentId);
    const agents = await prisma.agent.findMany({
      where: { id: { in: agentIds } },
    });

    const agentMap = new Map(agents.map((a) => [a.id, a]));

    return NextResponse.json({
      realmId: params.id,
      realmName: realm.name,
      totalMembers: members.length,
      members: members.map((m) => ({
        pubkey: m.pubkey,
        agentId: m.agentId,
        agentName: agentMap.get(m.agentId)?.name ?? null,
        joinedAt: m.joinedAt,
      })),
    });
  } catch (error) {
    console.error("Get members error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
