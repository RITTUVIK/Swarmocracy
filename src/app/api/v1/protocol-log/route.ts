import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const events = await prisma.protocolEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(events.reverse());
  } catch {
    return NextResponse.json([]);
  }
}
