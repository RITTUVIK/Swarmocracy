import { prisma } from "./prisma";
import { getTreasuryKeypair } from "./treasury";
import { executeBorrow, BorrowParams } from "./omnipair";

export async function executeProposal(proposalId: string): Promise<{
  status: string;
  txSignature?: string;
  error?: string;
}> {
  const proposal = await prisma.proposalCache.findUnique({
    where: { id: proposalId },
    include: { votes: true },
  });

  if (!proposal) throw new Error("Proposal not found");

  if (proposal.executionStatus === "success") {
    throw new Error("Proposal already executed");
  }

  const yesVotes = proposal.votes.filter((v) => v.vote === "yes").length;
  const total = proposal.votes.length;
  const approvalPct = total > 0 ? (yesVotes / total) * 100 : 0;

  if (approvalPct < 60 || proposal.state !== "Succeeded") {
    throw new Error(
      `Proposal has not passed. State: ${proposal.state}, Approval: ${approvalPct.toFixed(0)}%`
    );
  }

  if (proposal.proposalType !== "omnipair_borrow") {
    throw new Error(`Unsupported execution type: ${proposal.proposalType}`);
  }

  let params: BorrowParams;
  try {
    params = JSON.parse(proposal.executionParams || "{}");
  } catch {
    throw new Error("Invalid execution parameters");
  }

  if (
    !params.pairAddress ||
    !params.collateralMint ||
    !params.collateralAmount ||
    !params.borrowMint ||
    !params.borrowAmount
  ) {
    throw new Error("Missing required borrow parameters");
  }

  await prisma.proposalCache.update({
    where: { id: proposalId },
    data: { executionStatus: "executing" },
  });

  const log = await prisma.executionLog.create({
    data: {
      proposalId,
      type: "omnipair_borrow",
      status: "executing",
      inputParams: JSON.stringify(params),
    },
  });

  await logProtocolEvent("EXECUTE_START", `Executing Omnipair borrow for proposal ${proposalId.slice(0, 8)}...`);

  const treasuryKeypair = await getTreasuryKeypair(proposal.realmId);
  if (!treasuryKeypair) {
    const errorMsg = "No treasury wallet configured for this realm";
    await prisma.executionLog.update({
      where: { id: log.id },
      data: { status: "failed", error: errorMsg },
    });
    await prisma.proposalCache.update({
      where: { id: proposalId },
      data: { executionStatus: "failed" },
    });
    await logProtocolEvent("ERROR", `Execution failed: ${errorMsg}`);
    return { status: "failed", error: errorMsg };
  }

  try {
    const result = await executeBorrow(treasuryKeypair, params);

    await prisma.executionLog.update({
      where: { id: log.id },
      data: {
        status: "success",
        txSignature: result.txSignature,
        executedAt: new Date(),
        outputData: JSON.stringify(result),
      },
    });

    await prisma.proposalCache.update({
      where: { id: proposalId },
      data: {
        executionStatus: "success",
        executionTxSignature: result.txSignature,
        state: "Completed",
      },
    });

    await logProtocolEvent(
      "EXECUTE_DONE",
      `Omnipair borrow executed. TX: ${result.txSignature.slice(0, 16)}...`
    );

    return { status: "success", txSignature: result.txSignature };
  } catch (err: any) {
    const errorMsg = err.message || "Unknown execution error";

    await prisma.executionLog.update({
      where: { id: log.id },
      data: { status: "failed", error: errorMsg },
    });

    await prisma.proposalCache.update({
      where: { id: proposalId },
      data: { executionStatus: "failed" },
    });

    await logProtocolEvent("ERROR", `Execution failed: ${errorMsg}`);

    return { status: "failed", error: errorMsg };
  }
}

export async function logProtocolEvent(
  type: string,
  message: string,
  metadata?: string
) {
  await prisma.protocolEvent.create({
    data: { type, message, metadata },
  });
}
