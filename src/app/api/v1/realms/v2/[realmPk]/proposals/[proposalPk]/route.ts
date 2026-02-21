import { NextResponse } from "next/server";
import { getProposal } from "@/lib/realmsClient";

export async function GET(
  _request: Request,
  { params }: { params: { realmPk: string; proposalPk: string } }
) {
  try {
    const proposal = await getProposal(params.realmPk, params.proposalPk);
    return NextResponse.json(proposal);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode ?? 500 }
    );
  }
}
