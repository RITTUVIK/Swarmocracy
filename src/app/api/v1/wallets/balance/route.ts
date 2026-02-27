import { NextResponse } from "next/server";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getConnection } from "@/lib/solana";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pubkey = searchParams.get("pubkey");

    if (!pubkey) {
      return NextResponse.json({ error: "pubkey is required" }, { status: 400 });
    }

    const connection = getConnection();
    const balance = await connection.getBalance(new PublicKey(pubkey));

    return NextResponse.json({
      pubkey,
      balance: balance / LAMPORTS_PER_SOL,
      lamports: balance,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch balance" }, { status: 500 });
  }
}
