/**
 * Realms MCP client — AI agent query/propose/vote interface.
 * Connects to https://v2.realms.today/api/mcp
 *
 * MCP responses are unsigned transactions; they NEVER auto-sign.
 * Signing is routed to walletManager + txOrchestrator.
 */

const MCP_ENDPOINT = "https://v2.realms.today/api/mcp";

export interface McpToolCall {
  tool: string;
  arguments: Record<string, unknown>;
}

export interface McpResponse {
  result?: unknown;
  error?: string;
}

async function callMcp(toolCall: McpToolCall): Promise<McpResponse> {
  const res = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "tools/call",
      params: {
        name: toolCall.tool,
        arguments: toolCall.arguments,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `MCP error [${res.status}]: ${text}` };
  }

  const data = await res.json();
  return { result: data.result ?? data };
}

// ─── Search & Read ────────────────────────────────────────────────────

export async function searchRealms(query: string): Promise<McpResponse> {
  return callMcp({ tool: "SearchRealms", arguments: { query } });
}

export async function mcpGetDAO(realmPk: string): Promise<McpResponse> {
  return callMcp({ tool: "GetDAO", arguments: { realmPk } });
}

export async function mcpListProposals(
  realmPk: string,
  state?: string
): Promise<McpResponse> {
  return callMcp({
    tool: "ListProposals",
    arguments: { realmPk, ...(state ? { state } : {}) },
  });
}

export async function mcpGetProposal(
  realmPk: string,
  proposalPk: string
): Promise<McpResponse> {
  return callMcp({
    tool: "GetProposal",
    arguments: { realmPk, proposalPk },
  });
}

export async function mcpGetTreasury(realmPk: string): Promise<McpResponse> {
  return callMcp({ tool: "GetTreasury", arguments: { realmPk } });
}

// ─── Write (return unsigned txs — no signing here) ────────────────────

export async function mcpCreateProposal(params: {
  realmPk: string;
  governancePk: string;
  walletPk: string;
  name: string;
  description: string;
  instructions?: unknown[];
}): Promise<McpResponse> {
  return callMcp({ tool: "CreateProposal", arguments: params });
}

export async function mcpCastVote(params: {
  realmPk: string;
  proposalPk: string;
  walletPk: string;
  vote: "yes" | "no" | "abstain" | "veto";
}): Promise<McpResponse> {
  return callMcp({ tool: "CastVote", arguments: params });
}

export async function mcpCreateSowellianBet(params: {
  realmPk: string;
  governancePk: string;
  walletPk: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  expiry?: number;
  description?: string;
}): Promise<McpResponse> {
  return callMcp({ tool: "CreateSowellianBet", arguments: params });
}
