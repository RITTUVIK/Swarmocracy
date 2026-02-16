import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedPubkey } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { name, walletPubkey, description } = await request.json();

    if (!name || !walletPubkey) {
      return NextResponse.json(
        { error: "name and walletPubkey are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.agent.findUnique({
      where: { walletPubkey },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Agent with this wallet already registered" },
        { status: 409 }
      );
    }

    const agent = await prisma.agent.create({
      data: { name, walletPubkey, description },
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error("Register agent error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const agents = await prisma.agent.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(agents);
  } catch (error) {
    console.error("List agents error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
