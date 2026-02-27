import { NextRequest, NextResponse } from "next/server";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getConnection, getCluster } from "@/lib/solana";

export async function POST(request: NextRequest) {
  try {
    const { pubkey, amount } = await request.json();

    if (!pubkey) {
      return NextResponse.json({ error: "pubkey is required" }, { status: 400 });
    }

    const cluster = getCluster();
    if (cluster === "mainnet-beta") {
      return NextResponse.json(
        { error: "Airdrop is only available on devnet" },
        { status: 403 }
      );
    }

    let pk: PublicKey;
    try {
      pk = new PublicKey(pubkey);
    } catch {
      return NextResponse.json({ error: "Invalid public key" }, { status: 400 });
    }

    const solAmount = Math.min(Number(amount) || 1, 2); // max 2 SOL per airdrop
    const connection = getConnection();
    const signature = await connection.requestAirdrop(
      pk,
      solAmount * LAMPORTS_PER_SOL
    );

    // Wait for confirmation
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });

    const balance = await connection.getBalance(pk);

    return NextResponse.json(
      {
        success: true,
        signature,
        amount: solAmount,
        balance: balance / LAMPORTS_PER_SOL,
        network: cluster,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Airdrop failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
