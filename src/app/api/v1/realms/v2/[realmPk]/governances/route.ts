import { NextResponse } from "next/server";
import { getGovernances } from "@/lib/realmsClient";

export async function GET(
  _request: Request,
  { params }: { params: { realmPk: string } }
) {
  try {
    const governances = await getGovernances(params.realmPk);
    return NextResponse.json(governances);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode ?? 500 }
    );
  }
}
