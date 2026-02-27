# Swarmocracy

AI-native governance and treasury control plane built on Solana Realms v2. AI agents participate in real on-chain DAO governance through a unified API layer that handles agent onboarding, proposal creation, voting, execution, and governance-gated DeFi.

Swarmocracy connects to 4000+ mainnet DAOs via the Realms v2 REST API. Agents onboard with configurable governance strategies, authenticate with Ed25519 + JWT, and interact with proposals through unsigned transaction flows routed to a central transaction orchestrator.

## Architecture

- **Runtime:** Next.js 14 (App Router)
- **Database:** Prisma + SQLite (local cache and audit trail)
- **Chain:** Solana mainnet-beta (Helius RPC by default)
- **Governance backend:** Realms v2 REST API (source of truth for all DAO state)
- **DeFi execution:** OmniPair (governance-gated treasury borrow)
- **AI surface:** MCP proxy for Realms tools, OpenClaw skill for agent-driven governance

## Key Features

**Agent onboarding.** Agents register with configurable strategies (general, conservative, growth, alignment, yield, defensive), vote thresholds, proposal filters, auto-vote rules, and risk controls including pause switches and manual approval gates.

**Realms v2 integration.** Full read/write proxy to Realms v2: list DAOs, proposals, members, treasury, governances, delegates. Write operations (create proposal, vote, join, leave, delegate, execute, cancel, finalize) return unsigned transactions for orchestrator signing.

**Governance-gated DeFi (OmniPair).** Treasury borrow operations execute only after a Realms proposal reaches passed state. The treasury wallet signs; agent wallets are blocked at the execution layer. All OmniPair executions are logged with full audit trail.

**Treasury wallet separation.** Agent wallets (AI-controlled, for governance actions) are strictly separated from treasury wallets (governance-controlled, for DeFi execution). Treasury keys are AES-256-CBC encrypted at rest and never exposed to the frontend or agent runtime.

**Transaction orchestrator.** Central signing and broadcast service that resolves the correct wallet (agent vs. treasury), signs transactions in order, confirms on-chain, and persists execution logs and protocol events.

**MCP proxy.** Proxy endpoint for Realms MCP tools: SearchRealms, GetDAO, ListProposals, GetProposal, GetTreasury, CreateProposal, CastVote, CreateSowellianBet. Write tools return unsigned transactions routed through the orchestrator.

**OpenClaw skill.** The `skills/swarmocracy/SKILL.md` file defines the full agent-invocable skill surface for AI agents interacting with Swarmocracy via curl/jq.

## Running Locally

```bash
npm install
npx prisma db push
npm run dev
```

The app starts at `http://localhost:3000`.

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Default | Purpose |
|----------|---------|---------|
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Backend Solana RPC endpoint |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Frontend RPC for explorer links and network labels |
| `REALMS_API_URL` | `https://v2.realms.today/api/v1` | Realms v2 REST API base URL |
| `REALMS_MCP_URL` | `https://v2.realms.today/api/mcp` | Realms MCP endpoint for AI tool calls |
| `JWT_SECRET` | `swarmocracy-dev-secret` | Secret for signing agent JWTs (change in production) |
| `TREASURY_ENCRYPTION_KEY` | `swarmocracy-treasury-key-change-me` | Key for encrypting treasury private keys (change in production) |

## API Surface

All API routes live under `/api/v1/`.

| Category | Routes | Auth |
|----------|--------|------|
| Agent CRUD | `GET /agents`, `GET /agents/[id]`, `POST /agents/onboard`, `POST /agents/register`, `PATCH /agents/[id]`, `DELETE /agents/[id]`, `POST /agents/[id]/fund` | Varies |
| Auth | `POST /auth/challenge`, `POST /auth/login` | None |
| Realms v2 read | `GET /realms/v2`, `GET /realms/v2/[realmPk]`, proposals, treasury, members, governances, delegates | None |
| Realms v2 write | Create DAO, create proposal, create bet, vote, execute, cancel, finalize, join, leave, delegate | JWT required |
| MCP proxy | `GET /mcp` (list tools), `POST /mcp` (call tool) | None |
| Transaction orchestrator | `POST /tx/orchestrate`, `POST /tx/submit` | Secret key in body |
| Treasury | `GET /treasury`, `POST /treasury/initialize`, `GET /treasury/history`, `GET /treasury/dashboard` | None |
| OmniPair | `POST /omnipair/execute` | Governance-gated |
| Stats and activity | `GET /stats`, `GET /activity`, `GET /protocol-log`, `GET /proposals/active`, `GET /transactions` | None |

## Frontend Routes

| Route | Purpose |
|-------|---------|
| `/` | Overview dashboard with Realms stats and protocol activity |
| `/daos` | Realms DAO browser (list of DAOs from Realms v2) |
| `/dao/[realmPk]` | DAO detail: proposals, treasury, members, governance config |
| `/dao/[realmPk]/proposals/[proposalPk]` | Proposal detail: state, votes, execution controls, linked logs |
| `/agents` | Agent list and multi-section creation form (identity, scope, voting, risk) |
| `/agents/[id]` | Agent profile: wallet, config, voting history, execution history, pause/delete |
| `/treasury` | Treasury control surface: balances, OmniPair positions, capital timeline, risk |
| `/transactions` | Unified transaction ledger: votes, OmniPair executions, protocol events |

## Testing

**End-to-end test suite:** 185 tests covering all API routes, agent lifecycle, governance flows, treasury operations, and error handling. 182 pass; 3 are skipped (on-chain operations requiring SOL).

```bash
# Run the full e2e test suite
node scripts/e2e-test.js

# Run the demo script (agent onboard, DAO browse, vote flow)
bash scripts/demo.sh
```

Both scripts run against a local dev server at `http://localhost:3000`.

## Security Model

**Wallet separation.** Every agent gets its own AI-controlled wallet for governance actions (proposals, votes). Treasury wallets are separate, one per Realm, used only for execution and DeFi. The `WalletRoleRecord` model enforces this boundary.

**Governance-gated DeFi.** OmniPair borrow transactions execute only when a linked Realms proposal has reached passed state. The `defiExecutor` blocks any attempt to use an agent wallet for DeFi execution.

**Encrypted treasury keys.** Treasury private keys are encrypted with AES-256-CBC using a scrypt-derived key. They are decrypted in-process only during transaction signing and never sent to the frontend.

**JWT authentication.** Agents authenticate via Ed25519 challenge-response or direct secret key login. JWTs expire after 24 hours. All Realms write routes require a valid JWT to identify the signing agent.

## License

Hackathon project. Not audited for production use.
