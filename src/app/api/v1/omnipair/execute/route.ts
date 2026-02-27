import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logProtocolEvent } from "@/lib/execution";
import { executeBorrow, BorrowParams } from "@/lib/omnipair";
import { getTreasuryKeypair } from "@/lib/treasury";

/**
 * POST /api/v1/omnipair/execute
 *
 * Governance-gated OmniPair execution.
 * Only executes if the linked proposal has status "Succeeded" or "Completed".
 * Never allows direct execution without governance approval.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { proposalPk, daoPk, executionType, assetMint, collateralMint, amount, params } = body;

    if (!proposalPk || !daoPk || !executionType) {
      return NextResponse.json(
        { error: "proposalPk, daoPk, and executionType are required" },
        { status: 400 }
      );
    }

    const validTypes = ["borrow", "lend", "repay", "refinance"];
    if (!validTypes.includes(executionType)) {
      return NextResponse.json(
        { error: `executionType must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Governance gate: verify proposal passed
    const proposal = await prisma.proposalCache.findUnique({ where: { id: proposalPk } });

    const passedStates = ["Succeeded", "Completed", "Executed", "3", "6"];
    if (!proposal || !passedStates.includes(proposal.state)) {
      return NextResponse.json(
        { error: "OmniPair execution requires a passed governance proposal. Current state: " + (proposal?.state ?? "not found") },
        { status: 403 }
      );
    }

    // Create pending execution record BEFORE execution
    const execution = await prisma.omniPairExecution.create({
      data: {
        daoPk,
        proposalPk,
        executionType,
        assetMint: assetMint || "",
        collateralMint: collateralMint || null,
        amount: amount || "0",
        status: "pending",
        executedBy: "governance",
      },
    });

    await logProtocolEvent(
      "OMNIPAIR_EXEC_START",
      `OmniPair ${executionType} initiated for proposal ${proposalPk.slice(0, 8)}...`
    );

    // Resolve treasury keypair
    const keypair = await getTreasuryKeypair(daoPk);
    if (!keypair) {
      await prisma.omniPairExecution.update({
        where: { id: execution.id },
        data: { status: "failed", errorMessage: "No treasury keypair configured for this DAO" },
      });
      return NextResponse.json(
        { error: "No treasury keypair configured for this DAO" },
        { status: 400 }
      );
    }

    try {
      let txSignature: string;

      if (executionType === "borrow") {
        const borrowParams: BorrowParams = {
          pairAddress: params?.pairAddress,
          collateralMint: params?.collateralMint || collateralMint,
          collateralAmount: params?.collateralAmount || amount,
          borrowMint: params?.borrowMint || assetMint,
          borrowAmount: params?.borrowAmount || amount,
        };
        const result = await executeBorrow(keypair, borrowParams);
        txSignature = result.txSignature;
      } else {
        // For lend/repay/refinance — placeholder until on-chain programs are verified
        return NextResponse.json(
          { error: `${executionType} execution not yet enabled. Only borrow is live.` },
          { status: 501 }
        );
      }

      // Update execution record
      await prisma.omniPairExecution.update({
        where: { id: execution.id },
        data: {
          status: "executed",
          txSignature,
          treasuryPk: keypair.publicKey.toBase58(),
          executedAt: new Date(),
        },
      });

      // Log to ExecutionLog for proposal tracking
      await prisma.executionLog.create({
        data: {
          proposalId: proposalPk,
          type: `omnipair_${executionType}`,
          status: "success",
          txSignature,
          inputParams: JSON.stringify(params || {}),
          outputData: JSON.stringify({ executionId: execution.id }),
          executedAt: new Date(),
        },
      });

      await logProtocolEvent(
        "OMNIPAIR_EXEC_DONE",
        `OmniPair ${executionType} succeeded: ${txSignature.slice(0, 16)}...`
      );

      return NextResponse.json({
        executionId: execution.id,
        status: "executed",
        txSignature,
        executionType,
      });
    } catch (execErr: any) {
      const errorMessage = execErr.message || "Execution failed";

      await prisma.omniPairExecution.update({
        where: { id: execution.id },
        data: { status: "failed", errorMessage },
      });

      await logProtocolEvent(
        "OMNIPAIR_EXEC_FAIL",
        `OmniPair ${executionType} failed: ${errorMessage.slice(0, 80)}`
      );

      return NextResponse.json(
        { error: errorMessage, executionId: execution.id },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("OmniPair execute error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
