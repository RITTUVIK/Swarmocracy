import { NextResponse } from "next/server";
import { initializeTreasury, getTreasuryInfo } from "@/lib/treasury";
import { logProtocolEvent } from "@/lib/execution";

export async function POST(request: Request) {
  try {
    const { realmId } = await request.json();

    if (!realmId) {
      return NextResponse.json(
        { error: "realmId is required" },
        { status: 400 }
      );
    }

    const result = await initializeTreasury(realmId);
    await logProtocolEvent(
      "INFO",
      `Treasury initialized for realm ${realmId.slice(0, 12)}...`
    );

    const info = await getTreasuryInfo(realmId);
    return NextResponse.json(info ?? result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
