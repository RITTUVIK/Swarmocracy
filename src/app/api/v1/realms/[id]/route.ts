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

    const proposals = await prisma.proposalCache.findMany({
      where: { realmId: params.id },
      orderBy: { createdAt: "desc" },
    });

    const { authoritySecret, ...safeRealm } = realm;
    return NextResponse.json({ ...safeRealm, proposals });
  } catch (error) {
    console.error("Get realm error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
