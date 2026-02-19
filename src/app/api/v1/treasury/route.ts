import { NextResponse } from "next/server";
import { getTreasuryInfo } from "@/lib/treasury";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const realmId = searchParams.get("realmId") ?? undefined;
    const info = await getTreasuryInfo(realmId);
    if (!info) {
      return NextResponse.json(
        { error: "No treasury configured" },
        { status: 404 }
      );
    }
    return NextResponse.json(info);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
