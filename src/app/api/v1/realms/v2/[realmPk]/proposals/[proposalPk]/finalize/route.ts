import { NextResponse } from "next/server";
import { finalizeVoting } from "@/lib/realmsClient";

export async function POST(
  _request: Request,
  { params }: { params: { realmPk: string; proposalPk: string } }
) {
  try {
    const result = await finalizeVoting(params.realmPk, params.proposalPk);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode ?? 500 }
    );
  }
}
