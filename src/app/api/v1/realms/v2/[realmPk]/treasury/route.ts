import { NextResponse } from "next/server";
import { getTreasury } from "@/lib/realmsClient";

export async function GET(
  _request: Request,
  { params }: { params: { realmPk: string } }
) {
  try {
    const assets = await getTreasury(params.realmPk);
    return NextResponse.json(assets);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode ?? 500 }
    );
  }
}
