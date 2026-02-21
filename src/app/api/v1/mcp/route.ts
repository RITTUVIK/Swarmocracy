import { NextResponse } from "next/server";
import * as McpClient from "@/lib/realmsMcp";

const TOOL_MAP: Record<string, (args: any) => Promise<any>> = {
  SearchRealms: (args) => McpClient.searchRealms(args.query),
  GetDAO: (args) => McpClient.mcpGetDAO(args.realmPk),
  ListProposals: (args) => McpClient.mcpListProposals(args.realmPk, args.state),
  GetProposal: (args) =>
    McpClient.mcpGetProposal(args.realmPk, args.proposalPk),
  GetTreasury: (args) => McpClient.mcpGetTreasury(args.realmPk),
  CreateProposal: (args) => McpClient.mcpCreateProposal(args),
  CastVote: (args) => McpClient.mcpCastVote(args),
  CreateSowellianBet: (args) => McpClient.mcpCreateSowellianBet(args),
};

export async function POST(request: Request) {
  try {
    const { tool, arguments: args } = await request.json();

    if (!tool) {
      return NextResponse.json(
        { error: "tool name is required" },
        { status: 400 }
      );
    }

    const handler = TOOL_MAP[tool];
    if (!handler) {
      return NextResponse.json(
        {
          error: `Unknown MCP tool: ${tool}`,
          availableTools: Object.keys(TOOL_MAP),
        },
        { status: 400 }
      );
    }

    const result = await handler(args ?? {});

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      tool,
      result: result.result ?? result,
      note:
        "Write operations return unsigned transactions. " +
        "DO NOT auto-sign. Route to POST /api/v1/tx/orchestrate for signing.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "MCP call failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "Realms MCP Proxy",
    tools: Object.keys(TOOL_MAP),
    note:
      "POST with { tool, arguments } to call MCP. " +
      "Write tools return unsigned transactions — signing is NOT automatic.",
  });
}
