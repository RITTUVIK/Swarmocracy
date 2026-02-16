import { NextResponse } from "next/server";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getConnection } from "@/lib/solana";

export async function POST(request: Request) {
  try {
    const { pubkey, amount } = await request.json();

    if (!pubkey) {
      return NextResponse.json(
        { error: "pubkey is required" },
        { status: 400 }
      );
    }

    const connection = getConnection();
    const solAmount = Math.min(amount || 1, 2); // Max 2 SOL per airdrop
    const signature = await connection.requestAirdrop(
      new PublicKey(pubkey),
      solAmount * LAMPORTS_PER_SOL
    );

    await connection.confirmTransaction(signature);

    return NextResponse.json({ signature, amount: solAmount });
  } catch (error) {
    console.error("Airdrop error:", error);
    return NextResponse.json({ error: "Airdrop failed" }, { status: 500 });
  }
}
