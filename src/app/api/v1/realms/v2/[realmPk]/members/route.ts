import { NextResponse } from "next/server";
import { getMembers } from "@/lib/realmsClient";

export async function GET(
  _request: Request,
  { params }: { params: { realmPk: string } }
) {
  try {
    const members = await getMembers(params.realmPk);
    return NextResponse.json(members);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode ?? 500 }
    );
  }
}
