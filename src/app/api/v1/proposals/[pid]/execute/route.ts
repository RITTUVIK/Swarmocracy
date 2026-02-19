import { NextResponse } from "next/server";
import { executeProposal } from "@/lib/execution";

export async function POST(
  _request: Request,
  { params }: { params: { pid: string } }
) {
  try {
    const result = await executeProposal(params.pid);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Execution failed", status: "failed" },
      { status: 400 }
    );
  }
}
