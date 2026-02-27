import { NextRequest, NextResponse } from "next/server";
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { prisma } from "@/lib/prisma";
import { getConnection, getCluster } from "@/lib/solana";

/**
 * POST /api/v1/agents/:id/fund
 *
 * On devnet: auto-airdrops SOL to the agent wallet (no senderSecret needed).
 * On mainnet/custom: builds an unsigned SOL transfer tx from sender → agent.
 *
 * Body: { amount?: number, senderPubkey?: string, senderSecret?: string }
 *   - amount: SOL to send (default 1, max 2 on devnet airdrop)
 *   - senderPubkey: required on mainnet (returns unsigned tx)
 *   - senderSecret: optional on mainnet (signs+sends if provided)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await prisma.agent.findUnique({ where: { id: params.id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const body = await request.json();
    const amount = Math.max(0.001, Math.min(Number(body.amount) || 1, 10));
    const cluster = getCluster();
    const connection = getConnection();
    const agentPk = new PublicKey(agent.walletPubkey);

    // Devnet: auto-airdrop
    if (cluster === "devnet") {
      const airdropAmount = Math.min(amount, 2); // devnet caps at 2 SOL
      const signature = await connection.requestAirdrop(
        agentPk,
        airdropAmount * LAMPORTS_PER_SOL
      );
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });
      const balance = await connection.getBalance(agentPk);

      return NextResponse.json({
        success: true,
        method: "airdrop",
        signature,
        amount: airdropAmount,
        agentPubkey: agent.walletPubkey,
        balance: balance / LAMPORTS_PER_SOL,
        network: cluster,
      });
    }

    // Mainnet/custom: build unsigned transfer tx
    const senderPubkey = body.senderPubkey;
    if (!senderPubkey) {
      return NextResponse.json(
        {
          error: "senderPubkey is required on mainnet. Provide the pubkey of the wallet funding this agent.",
          agentPubkey: agent.walletPubkey,
          amount,
        },
        { status: 400 }
      );
    }

    let senderPk: PublicKey;
    try {
      senderPk = new PublicKey(senderPubkey);
    } catch {
      return NextResponse.json({ error: "Invalid senderPubkey" }, { status: 400 });
    }

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: senderPk,
        toPubkey: agentPk,
        lamports: Math.round(amount * LAMPORTS_PER_SOL),
      })
    );

    const latestBlockhash = await connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = senderPk;

    const serialized = tx
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    return NextResponse.json({
      transaction: serialized,
      message: `Sign and send this transaction to transfer ${amount} SOL to agent ${agent.name} (${agent.walletPubkey}). Use POST /api/v1/tx/orchestrate or sign with your wallet.`,
      agentPubkey: agent.walletPubkey,
      amount,
      network: cluster,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fund agent failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
