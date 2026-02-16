import { NextResponse } from "next/server";
import { generateKeypair } from "@/lib/wallet";

export async function POST() {
  try {
    const keypair = generateKeypair();
    return NextResponse.json(keypair, { status: 201 });
  } catch (error) {
    console.error("Generate wallet error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
