import { prisma } from "./prisma";
import { executeProposalGeneric, ExecutionType } from "./defiExecutor";

/**
 * Execute a proposal by its ID.
 * Routes to the generic DeFi executor based on proposalType.
 */
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

  if (proposal.state !== "Succeeded") {
    throw new Error(`Proposal has not passed. State: ${proposal.state}`);
  }

  const type = proposal.proposalType as ExecutionType;
  let params: Record<string, unknown> = {};

  try {
    if (proposal.executionParams) params = JSON.parse(proposal.executionParams);
  } catch {
    throw new Error("Invalid execution parameters");
  }

  const result = await executeProposalGeneric({
    proposalId,
    realmPk: proposal.realmId,
    type,
    walletRole: "treasury",
    params,
  });

  return {
    status: result.status,
    txSignature: result.signatures[0],
    error: result.error,
  };
}

/**
 * Log a protocol event for audit trail and live dashboard.
 */
export async function logProtocolEvent(
  type: string,
  message: string,
  metadata?: string
) {
  try {
    await prisma.protocolEvent.create({
      data: { type, message, metadata },
    });
  } catch {
    console.error(`Failed to log protocol event: [${type}] ${message}`);
  }
}
