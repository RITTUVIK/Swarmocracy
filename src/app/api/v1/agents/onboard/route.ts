import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateKeypair } from "@/lib/wallet";
import { createToken } from "@/lib/auth";
import { isMainnet } from "@/lib/solana";

const VALID_STRATEGIES = ["general", "conservative", "growth", "alignment", "yield", "defensive"] as const;
const VALID_THRESHOLDS = ["simple_majority", "supermajority", "unanimous"] as const;
const VALID_FILTERS = ["all", "treasury_only", "parameter_only", "defi_only"] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const strategy = VALID_STRATEGIES.includes(body.strategy) ? body.strategy : "general";
    const voteThreshold = VALID_THRESHOLDS.includes(body.voteThreshold) ? body.voteThreshold : "simple_majority";
    const proposalFilter = VALID_FILTERS.includes(body.proposalFilter) ? body.proposalFilter : "all";

    let allowedDaos: string | null = null;
    if (Array.isArray(body.allowedDaos) && body.allowedDaos.length > 0) {
      allowedDaos = JSON.stringify(body.allowedDaos.filter((d: unknown) => typeof d === "string"));
    }

    let allowedMints: string | null = null;
    if (Array.isArray(body.allowedMints) && body.allowedMints.length > 0) {
      allowedMints = JSON.stringify(body.allowedMints.filter((m: unknown) => typeof m === "string"));
    }

    const maxVotingPowerPct = typeof body.maxVotingPowerPct === "number"
      ? Math.max(1, Math.min(100, Math.round(body.maxVotingPowerPct)))
      : 100;

    const autoVoteEnabled = body.autoVoteEnabled === true;
    const abstainOnLowInfo = body.abstainOnLowInfo !== false;
    const executionEnabled = body.executionEnabled === true;
    const requireApproval = body.requireApproval !== false;

    const { publicKey, secretKey } = generateKeypair();

    const agent = await prisma.agent.create({
      data: {
        name,
        walletPubkey: publicKey,
        description: description || null,
        strategy,
        allowedDaos,
        allowedMints,
        maxVotingPowerPct,
        autoVoteEnabled,
        voteThreshold,
        abstainOnLowInfo,
        proposalFilter,
        executionEnabled,
        requireApproval,
        paused: false,
      },
    });

    const token = await createToken(publicKey);

    try {
      const { logProtocolEvent } = await import("@/lib/execution");
      await logProtocolEvent("AGENT_JOIN", `${name} [${strategy}] (${publicKey.slice(0, 8)}...) connected to Hive`);
    } catch {}

    return NextResponse.json(
      {
        agent: {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          walletPubkey: agent.walletPubkey,
          strategy: agent.strategy,
          autoVoteEnabled: agent.autoVoteEnabled,
          executionEnabled: agent.executionEnabled,
          paused: agent.paused,
        },
        wallet: { publicKey, secretKey },
        token,
        network: isMainnet() ? "mainnet-beta" : "devnet",
        funding: isMainnet()
          ? { note: "This wallet needs SOL to pay transaction fees. Fund it manually with real SOL." }
          : { note: "Running on devnet. Use faucet to fund this wallet if needed." },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "An agent with this wallet already exists" }, { status: 409 });
    }
    console.error("Onboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
