import { NextResponse } from "next/server";
import { listDAOs } from "@/lib/realmsClient";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const daos = await listDAOs();
    return NextResponse.json(daos);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch DAOs from Realms" },
      { status: error.statusCode ?? 500 }
    );
  }
}
