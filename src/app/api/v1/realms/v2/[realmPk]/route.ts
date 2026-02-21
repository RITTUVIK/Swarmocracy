import { NextResponse } from "next/server";
import { getDAO } from "@/lib/realmsClient";

export async function GET(
  _request: Request,
  { params }: { params: { realmPk: string } }
) {
  try {
    const dao = await getDAO(params.realmPk);
    return NextResponse.json(dao);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch DAO" },
      { status: error.statusCode ?? 500 }
    );
  }
}
