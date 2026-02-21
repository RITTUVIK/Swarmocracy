import { NextResponse } from "next/server";
import { getDelegates } from "@/lib/realmsClient";

export async function GET(
  _request: Request,
  { params }: { params: { realmPk: string } }
) {
  try {
    const delegates = await getDelegates(params.realmPk);
    return NextResponse.json(delegates);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode ?? 500 }
    );
  }
}
