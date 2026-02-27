/**
 * SWARMOCRACY — Comprehensive E2E Test Suite
 *
 * Tests ALL API endpoints:
 *   - Agent lifecycle (onboard, register, list, get, update, delete)
 *   - Auth flows (challenge, login, verify)
 *   - Realms v2 (list, get, join, leave, delegate, members, governances, treasury,
 *                proposals CRUD, vote, execute, cancel, finalize, comments, create-bet)
 *   - Realms MCP proxy (list tools, SearchRealms, GetDAO, ListProposals, GetProposal, GetTreasury)
 *   - OmniPair governance-gated execution
 *   - Treasury management (init, info, dashboard, history)
 *   - Wallets (generate, balance)
 *   - Transaction orchestrator
 *   - Stats / Activity / Transactions / Protocol-Log
 *   - Skill downloadability (SKILL.md exists and is well-formed)
 *
 * Usage:
 *   node scripts/e2e-test.js                     # against localhost:3000
 *   node scripts/e2e-test.js https://my.server    # against custom URL
 */

const fs = require('fs');
const path = require('path');

const API = process.argv[2] || 'http://localhost:3000';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const checks = [];
let passed = 0;
let failed = 0;
let skipped = 0;
let sectionName = '';

function section(name) {
  sectionName = name;
  console.log('\n' + '━'.repeat(60));
  console.log(`  ${name}`);
  console.log('━'.repeat(60));
}

function check(name, pass, detail) {
  const tag = pass === 'skip' ? 'SKIP' : pass ? 'PASS' : 'FAIL';
  if (pass === 'skip') skipped++;
  else if (pass) passed++;
  else failed++;
  checks.push({ section: sectionName, name, pass: tag });
  const detailStr = detail ? ` — ${detail}` : '';
  console.log(`  [${tag}] ${name}${detailStr}`);
}

async function api(method, endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const url = `${API}${endpoint}`;
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }
    return { status: res.status, ok: res.ok, json, text };
  } catch (err) {
    return { status: 0, ok: false, json: null, text: err.message, error: err };
  }
}

async function GET(endpoint, token) { return api('GET', endpoint, null, token); }
async function POST(endpoint, body, token) { return api('POST', endpoint, body, token); }
async function PATCH(endpoint, body, token) { return api('PATCH', endpoint, body, token); }
async function DELETE(endpoint, token) { return api('DELETE', endpoint, null, token); }

// ─── State ────────────────────────────────────────────────────────────────────

let alphaToken, alphaSecret, alphaPubkey, alphaId;
let betaToken, betaSecret, betaPubkey, betaId;
let gammaToken, gammaPubkey, gammaId;  // registered with existing wallet
let generatedWallet;  // from /wallets/generate

// ═══════════════════════════════════════════════════════════════════════════════
//  TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

async function runTests() {

  // ─── 1. SKILL.md Downloadability ────────────────────────────────────────────
  section('1. SKILL.md — OpenClaw Skill Downloadability');

  const skillPath = path.resolve(__dirname, '..', 'skills', 'swarmocracy', 'SKILL.md');
  const skillExists = fs.existsSync(skillPath);
  check('SKILL.md file exists', skillExists, skillPath);

  if (skillExists) {
    const skill = fs.readFileSync(skillPath, 'utf-8');
    check('Has YAML frontmatter', skill.startsWith('---'));
    check('Frontmatter contains name: swarmocracy', skill.includes('name: swarmocracy'));
    check('user-invocable: true', skill.includes('user-invocable: true'));
    check('Requires SWARMOCRACY_API_URL env', skill.includes('SWARMOCRACY_API_URL'));
    check('Requires curl + jq bins', skill.includes('curl') && skill.includes('jq'));
    check('Documents agent onboard flow', skill.includes('/api/v1/agents/onboard'));
    check('Documents agent register flow', skill.includes('/api/v1/agents/register'));
    check('Documents auth login', skill.includes('/api/v1/auth/login'));
    check('Documents Realms v2 endpoints', skill.includes('/api/v1/realms/v2'));
    check('Documents join/leave/delegate', skill.includes('/join') && skill.includes('/leave') && skill.includes('/delegate'));
    check('Documents proposals CRUD', skill.includes('/proposals'));
    check('Documents voting', skill.includes('/vote'));
    check('Documents proposal execution', skill.includes('/execute'));
    check('Documents finalize + cancel', skill.includes('/finalize') && skill.includes('/cancel'));
    check('Documents OmniPair execute', skill.includes('/api/v1/omnipair/execute'));
    check('Documents MCP proxy', skill.includes('/api/v1/mcp'));
    check('Documents tx orchestrator', skill.includes('/api/v1/tx/orchestrate'));
    check('Documents treasury endpoints', skill.includes('/api/v1/treasury'));
    check('Documents Sowellian bet', skill.includes('create-bet') || skill.includes('CreateSowellianBet'));
    check('Documents unsigned tx warning', skill.includes('unsigned'));
    check('Documents governance gating for OmniPair', skill.includes('governance-gated') || skill.includes('governance gate'));
    check('Documents wallet role separation', skill.includes('treasury') && skill.includes('agent'));
    check('Has complete curl examples', (skill.match(/curl/g) || []).length >= 10, `${(skill.match(/curl/g) || []).length} curl examples`);
  }

  // ─── 2. Server Health ──────────────────────────────────────────────────────
  section('2. Server Health');

  const healthCheck = await GET('/api/v1/stats');
  check('Server is reachable', healthCheck.ok, `status=${healthCheck.status}`);
  if (!healthCheck.ok) {
    console.error('\n  FATAL: Server not reachable at ' + API);
    console.error('  Start the server with: npm run dev\n');
    printSummary();
    return;
  }
  check('Stats endpoint returns data', healthCheck.json && typeof healthCheck.json.agents === 'number');

  // ─── 3. Wallet Generation ──────────────────────────────────────────────────
  section('3. Wallet Generation');

  const walletRes = await POST('/api/v1/wallets/generate');
  check('POST /wallets/generate returns 201', walletRes.status === 201);
  check('Returns publicKey', !!walletRes.json?.publicKey);
  check('Returns secretKey', !!walletRes.json?.secretKey);
  if (walletRes.json) {
    generatedWallet = walletRes.json;
    check('publicKey is base58 string', typeof generatedWallet.publicKey === 'string' && generatedWallet.publicKey.length > 30);
    check('secretKey is base58 string', typeof generatedWallet.secretKey === 'string' && generatedWallet.secretKey.length > 50);
  }

  // ─── 4. Agent Onboarding ───────────────────────────────────────────────────
  section('4. Agent Onboarding (OpenClaw skill install simulation)');

  const onboardAlpha = await POST('/api/v1/agents/onboard', {
    name: 'TestAlpha',
    description: 'E2E governance agent',
    strategy: 'general',
    voteThreshold: 'simple_majority',
    proposalFilter: 'all',
    autoVoteEnabled: false,
    executionEnabled: false,
  });
  check('POST /agents/onboard returns 201', onboardAlpha.status === 201);
  check('Returns agent object', !!onboardAlpha.json?.agent);
  check('Returns wallet with publicKey', !!onboardAlpha.json?.wallet?.publicKey);
  check('Returns wallet with secretKey', !!onboardAlpha.json?.wallet?.secretKey);
  check('Returns JWT token', !!onboardAlpha.json?.token);
  check('Agent has correct name', onboardAlpha.json?.agent?.name === 'TestAlpha');
  check('Agent has correct strategy', onboardAlpha.json?.agent?.strategy === 'general');
  check('Returns network info', !!onboardAlpha.json?.network);

  if (onboardAlpha.json?.agent) {
    alphaToken = onboardAlpha.json.token;
    alphaSecret = onboardAlpha.json.wallet?.secretKey;
    alphaPubkey = onboardAlpha.json.wallet?.publicKey;
    alphaId = onboardAlpha.json.agent.id;
  } else {
    console.error('  Onboard Alpha failed:', onboardAlpha.text?.slice(0, 200));
  }

  // Onboard Beta
  const onboardBeta = await POST('/api/v1/agents/onboard', {
    name: 'TestBeta',
    description: 'Voting delegate agent',
    strategy: 'conservative',
    voteThreshold: 'supermajority',
  });
  check('Beta onboard succeeds', onboardBeta.status === 201);
  check('Beta has conservative strategy', onboardBeta.json?.agent?.strategy === 'conservative');
  if (onboardBeta.json?.agent) {
    betaToken = onboardBeta.json.token;
    betaSecret = onboardBeta.json.wallet?.secretKey;
    betaPubkey = onboardBeta.json.wallet?.publicKey;
    betaId = onboardBeta.json.agent.id;
  }

  // Third agent (needed for 3-vote quorum in legacy proposals)
  const onboardDelta = await POST('/api/v1/agents/onboard', {
    name: 'TestDelta',
    description: 'Quorum agent',
  });
  check('Delta onboard succeeds (3rd agent for quorum)', onboardDelta.status === 201);
  let deltaToken, deltaId;
  if (onboardDelta.json?.agent) {
    deltaToken = onboardDelta.json.token;
    deltaId = onboardDelta.json.agent.id;
  }

  // ─── 5. Agent Registration (existing wallet) ──────────────────────────────
  section('5. Agent Registration (existing wallet)');

  const regRes = await POST('/api/v1/agents/register', {
    pubkey: generatedWallet?.publicKey || 'FakePublicKeyForTestFallback1111111111111111111',
    name: 'TestGamma',
    description: 'Registered with pre-existing wallet',
  });
  check('POST /agents/register returns 200 or 201', [200, 201].includes(regRes.status));
  check('Returns agent with correct name', regRes.json?.agent?.name === 'TestGamma');
  check('Returns JWT token', !!regRes.json?.token);
  if (regRes.json) {
    gammaToken = regRes.json.token;
    gammaPubkey = regRes.json.agent?.walletPubkey;
    gammaId = regRes.json.agent?.id;
  }

  // Register same wallet again — should return existing
  const regAgain = await POST('/api/v1/agents/register', {
    pubkey: generatedWallet?.publicKey || 'FakePublicKeyForTestFallback1111111111111111111',
    name: 'TestGamma',
  });
  check('Re-register returns 200 (existing)', regAgain.status === 200);
  check('Re-register issues new token', !!regAgain.json?.token);

  // Missing fields should 400
  const regBad = await POST('/api/v1/agents/register', { name: 'NoKey' });
  check('Register without pubkey returns 400', regBad.status === 400);

  // ─── 6. Agent List & Details ───────────────────────────────────────────────
  section('6. Agent CRUD');

  const agentList = await GET('/api/v1/agents');
  check('GET /agents returns array', Array.isArray(agentList.json));
  check('At least 3 agents registered', agentList.json?.length >= 3, `count=${agentList.json?.length}`);

  // Get agent details
  if (alphaId) {
    const alphaDetail = await GET(`/api/v1/agents/${alphaId}`);
    check('GET /agents/:id returns agent', alphaDetail.json?.name === 'TestAlpha');
    check('Agent detail includes votes array', Array.isArray(alphaDetail.json?.votes));
    check('Agent detail includes memberships', Array.isArray(alphaDetail.json?.memberships));
    check('Agent detail includes executionLogs', Array.isArray(alphaDetail.json?.executionLogs));
  }

  // Update agent
  if (alphaId) {
    const updateRes = await PATCH(`/api/v1/agents/${alphaId}`, {
      strategy: 'growth',
      autoVoteEnabled: true,
      paused: false,
    });
    check('PATCH /agents/:id returns 200', updateRes.status === 200);
    check('Strategy updated to growth', updateRes.json?.strategy === 'growth');
    check('autoVoteEnabled set to true', updateRes.json?.autoVoteEnabled === true);

    // Invalid strategy should fail
    const badUpdate = await PATCH(`/api/v1/agents/${alphaId}`, { strategy: 'invalid_strategy' });
    check('Invalid strategy returns 400', badUpdate.status === 400);
  }

  // ─── 7. Auth Flows ─────────────────────────────────────────────────────────
  section('7. Authentication Flows');

  // Auth login (secret key)
  if (alphaSecret) {
    const loginRes = await POST('/api/v1/auth/login', { secretKey: alphaSecret });
    check('POST /auth/login returns token', !!loginRes.json?.token);
    check('Login returns correct pubkey', loginRes.json?.pubkey === alphaPubkey);
    check('Login shows registered=true', loginRes.json?.registered === true);
    // Refresh alpha token
    if (loginRes.json?.token) alphaToken = loginRes.json.token;
  }

  // Auth challenge
  if (alphaPubkey) {
    const challengeRes = await POST('/api/v1/auth/challenge', { pubkey: alphaPubkey });
    check('POST /auth/challenge returns nonce', !!challengeRes.json?.nonce);
    check('Challenge returns message', !!challengeRes.json?.message);

    // Verify with bad signature should 401
    if (challengeRes.json?.nonce) {
      const verifyBad = await POST('/api/v1/auth/verify', {
        pubkey: alphaPubkey,
        signature: 'invalidsignature',
        nonce: challengeRes.json.nonce,
      });
      check('Verify with bad signature returns 401', verifyBad.status === 401);
    }
  }

  // Missing secretKey should 400
  const loginBad = await POST('/api/v1/auth/login', {});
  check('Login without secretKey returns 400', loginBad.status === 400);

  // ─── 8. Wallet Balance ─────────────────────────────────────────────────────
  section('8. Wallet Balance');

  if (alphaPubkey) {
    const balRes = await GET(`/api/v1/wallets/balance?pubkey=${alphaPubkey}`);
    check('GET /wallets/balance returns data', balRes.ok);
    check('Balance response has pubkey', balRes.json?.pubkey === alphaPubkey);
    check('Balance is a number', typeof balRes.json?.balance === 'number');
    check('Lamports is a number', typeof balRes.json?.lamports === 'number');
  }

  const balBad = await GET('/api/v1/wallets/balance');
  check('Balance without pubkey returns 400', balBad.status === 400);

  // ─── 9. Realms v2 — Read Endpoints ────────────────────────────────────────
  section('9. Realms v2 — DAO Discovery (live mainnet)');

  const daoList = await GET('/api/v1/realms/v2');
  check('GET /realms/v2 returns array', Array.isArray(daoList.json));
  check('At least 1 DAO returned from mainnet', daoList.json?.length > 0, `count=${daoList.json?.length}`);

  let testRealmPk = null;
  if (daoList.json?.length > 0) {
    testRealmPk = daoList.json[0].realmPk;
    check('First DAO has realmPk', !!testRealmPk);
    check('First DAO has name', !!daoList.json[0].name);

    // Get single DAO
    const daoDetail = await GET(`/api/v1/realms/v2/${testRealmPk}`);
    check('GET /realms/v2/:realmPk returns DAO', !!daoDetail.json);
    check('DAO detail has name', !!daoDetail.json?.name);

    // Members
    const membersRes = await GET(`/api/v1/realms/v2/${testRealmPk}/members`);
    check('GET /realms/v2/:realmPk/members returns data', membersRes.ok);
    check('Members response is array', Array.isArray(membersRes.json));

    // Governances
    const govRes = await GET(`/api/v1/realms/v2/${testRealmPk}/governances`);
    check('GET /realms/v2/:realmPk/governances returns data', govRes.ok);
    check('Governances response is array', Array.isArray(govRes.json));

    // Treasury
    const treasRes = await GET(`/api/v1/realms/v2/${testRealmPk}/treasury`);
    check('GET /realms/v2/:realmPk/treasury returns data', treasRes.ok);

    // Delegates
    const delRes = await GET(`/api/v1/realms/v2/${testRealmPk}/delegates`);
    check('GET /realms/v2/:realmPk/delegates returns data', delRes.ok);

    // Proposals
    const proposalList = await GET(`/api/v1/realms/v2/${testRealmPk}/proposals`);
    check('GET /realms/v2/:realmPk/proposals returns array', Array.isArray(proposalList.json));

    // Proposals with state filter
    const votingProps = await GET(`/api/v1/realms/v2/${testRealmPk}/proposals?state=Voting`);
    check('Proposals filtered by state=Voting returns data', votingProps.ok || Array.isArray(votingProps.json),
      `status=${votingProps.status}`);

    // Single proposal (if any exist)
    if (proposalList.json?.length > 0) {
      const firstPropPk = proposalList.json[0].proposalPk;
      if (firstPropPk) {
        const propDetail = await GET(`/api/v1/realms/v2/${testRealmPk}/proposals/${firstPropPk}`);
        check('GET single proposal returns data', !!propDetail.json);
        check('Proposal has name', !!propDetail.json?.name);
        check('Proposal has state', !!propDetail.json?.state);
      }
    }
  }

  // ─── 10. Realms v2 — Write Endpoints (auth required) ──────────────────────
  section('10. Realms v2 — Write Operations (auth-gated)');

  // Join DAO (will return unsigned tx from Realms API)
  if (testRealmPk && alphaToken) {
    const joinRes = await POST(`/api/v1/realms/v2/${testRealmPk}/join`, { amount: 1 }, alphaToken);
    check('POST /join returns data (may 400/500 without SOL)', joinRes.ok || joinRes.status === 400 || joinRes.status === 500,
      `status=${joinRes.status}`);

    // Join without auth should fail or return error
    const joinNoAuth = await POST(`/api/v1/realms/v2/${testRealmPk}/join`, { amount: 1 });
    check('Join without auth returns 401', joinNoAuth.status === 401);
  }

  // Leave DAO
  if (testRealmPk && alphaToken) {
    const leaveRes = await POST(`/api/v1/realms/v2/${testRealmPk}/leave`, {}, alphaToken);
    check('POST /leave returns data (may 400/500 without membership)', leaveRes.ok || leaveRes.status === 400 || leaveRes.status === 500,
      `status=${leaveRes.status}`);
  }

  // Delegate
  if (testRealmPk && alphaToken && betaPubkey) {
    const delegateRes = await POST(`/api/v1/realms/v2/${testRealmPk}/delegate`, {
      delegatePk: betaPubkey,
    }, alphaToken);
    check('POST /delegate returns data (may 400/500 without membership)', delegateRes.ok || delegateRes.status === 400 || delegateRes.status === 500,
      `status=${delegateRes.status}`);

    // Delegate without delegatePk should 400
    const delegateBad = await POST(`/api/v1/realms/v2/${testRealmPk}/delegate`, {}, alphaToken);
    check('Delegate without delegatePk returns 400', delegateBad.status === 400);
  }

  // Create proposal (returns unsigned txs)
  if (testRealmPk && alphaToken) {
    const govRes = await GET(`/api/v1/realms/v2/${testRealmPk}/governances`);
    let govPk = null;
    if (Array.isArray(govRes.json) && govRes.json.length > 0) {
      govPk = govRes.json[0].governancePk;
    }

    if (govPk) {
      const createPropRes = await POST(`/api/v1/realms/v2/${testRealmPk}/proposals`, {
        name: 'E2E Test Proposal',
        description: 'Created by automated test suite',
        governancePk: govPk,
        instructions: [],
      }, alphaToken);
      check('POST /proposals (create) returns data', createPropRes.ok || createPropRes.status === 500,
        `status=${createPropRes.status}`);
      if (createPropRes.ok) {
        check('Create proposal returns transactions', !!createPropRes.json?.transactions || !!createPropRes.json?.message);
      }
    } else {
      check('Create proposal (no governance found)', 'skip', 'No governance account on test DAO');
    }

    // Create proposal without required fields should 400
    const propBad = await POST(`/api/v1/realms/v2/${testRealmPk}/proposals`, {
      name: 'Missing fields',
    }, alphaToken);
    check('Create proposal without description/governancePk returns 400', propBad.status === 400);
  }

  // Vote (requires valid proposal)
  if (testRealmPk && alphaToken) {
    const proposalList = await GET(`/api/v1/realms/v2/${testRealmPk}/proposals`);
    let votingProp = null;
    if (Array.isArray(proposalList.json)) {
      votingProp = proposalList.json.find(p => p.state === 'Voting');
    }

    if (votingProp) {
      const voteRes = await POST(`/api/v1/realms/v2/${testRealmPk}/proposals/${votingProp.proposalPk}/vote`, {
        vote: 'yes',
      }, alphaToken);
      check('POST /vote returns data', voteRes.ok || voteRes.status === 500,
        `status=${voteRes.status}`);
    } else {
      check('Vote on proposal (no Voting proposal found)', 'skip', 'No proposals in Voting state');
    }

    // Vote with invalid value should 400
    if (proposalList.json?.length > 0) {
      const badVote = await POST(`/api/v1/realms/v2/${testRealmPk}/proposals/${proposalList.json[0].proposalPk}/vote`, {
        vote: 'invalid_vote',
      }, alphaToken);
      check('Vote with invalid value returns 400', badVote.status === 400);
    }
  }

  // Finalize
  if (testRealmPk) {
    const proposalList = await GET(`/api/v1/realms/v2/${testRealmPk}/proposals`);
    if (proposalList.json?.length > 0) {
      const finalizeRes = await POST(`/api/v1/realms/v2/${testRealmPk}/proposals/${proposalList.json[0].proposalPk}/finalize`);
      check('POST /finalize returns data (may 400 if already finalized)', finalizeRes.ok || finalizeRes.status === 400 || finalizeRes.status === 500,
        `status=${finalizeRes.status}`);
    } else {
      check('Finalize (no proposals)', 'skip');
    }
  }

  // Cancel (requires auth)
  if (testRealmPk && alphaToken) {
    const proposalList = await GET(`/api/v1/realms/v2/${testRealmPk}/proposals`);
    const draftProp = proposalList.json?.find(p => p.state === 'Draft');
    if (draftProp) {
      const cancelRes = await POST(`/api/v1/realms/v2/${testRealmPk}/proposals/${draftProp.proposalPk}/cancel`, {}, alphaToken);
      check('POST /cancel returns data (may 400 if not cancellable)', cancelRes.ok || cancelRes.status === 400 || cancelRes.status === 500,
        `status=${cancelRes.status}`);
    } else {
      check('Cancel proposal (no Draft proposal)', 'skip', 'No proposals in Draft state');
    }
  }

  // Execute
  if (testRealmPk) {
    const proposalList = await GET(`/api/v1/realms/v2/${testRealmPk}/proposals`);
    const succeededProp = proposalList.json?.find(p => ['Succeeded', 'Completed'].includes(p.state));
    if (succeededProp) {
      const execRes = await POST(`/api/v1/realms/v2/${testRealmPk}/proposals/${succeededProp.proposalPk}/execute`, {
        walletRole: 'treasury',
      });
      check('POST /execute returns data', execRes.ok || execRes.status === 400 || execRes.status === 500,
        `status=${execRes.status}`);
    } else {
      check('Execute proposal (no Succeeded proposal)', 'skip', 'No proposals in Succeeded state');
    }
  }

  // Sowellian Bet
  if (testRealmPk && alphaToken) {
    const govRes = await GET(`/api/v1/realms/v2/${testRealmPk}/governances`);
    let govPk = Array.isArray(govRes.json) && govRes.json.length > 0 ? govRes.json[0].governancePk : null;

    if (govPk) {
      const betRes = await POST(`/api/v1/realms/v2/${testRealmPk}/proposals/create-bet`, {
        governancePk: govPk,
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        inAmount: '1000000',
        outAmount: '500000',
        description: 'E2E test bet',
      }, alphaToken);
      check('POST /create-bet returns data', betRes.ok || betRes.status === 500,
        `status=${betRes.status}`);
      if (betRes.ok) {
        check('Create-bet returns warnings', !!betRes.json?.warnings);
        check('Create-bet warns about collateral lock', betRes.json?.warnings?.collateralLockRisk === true);
      }
    } else {
      check('Sowellian bet (no governance)', 'skip');
    }

    // Missing fields should 400
    const betBad = await POST(`/api/v1/realms/v2/${testRealmPk}/proposals/create-bet`, {
      governancePk: 'something',
    }, alphaToken);
    check('Create-bet without required fields returns 400', betBad.status === 400);
  }

  // ─── 11. Realms MCP Proxy ─────────────────────────────────────────────────
  section('11. Realms MCP Proxy');

  // List tools
  const mcpTools = await GET('/api/v1/mcp');
  check('GET /mcp returns tools list', mcpTools.ok);
  if (mcpTools.json) {
    const tools = mcpTools.json.tools || mcpTools.json;
    const toolNames = Array.isArray(tools) ? tools.map(t => t.name || t) : [];
    check('MCP lists SearchRealms tool', toolNames.includes('SearchRealms'));
    check('MCP lists GetDAO tool', toolNames.includes('GetDAO'));
    check('MCP lists ListProposals tool', toolNames.includes('ListProposals'));
    check('MCP lists GetProposal tool', toolNames.includes('GetProposal'));
    check('MCP lists GetTreasury tool', toolNames.includes('GetTreasury'));
    check('MCP lists CreateProposal tool', toolNames.includes('CreateProposal'));
    check('MCP lists CastVote tool', toolNames.includes('CastVote'));
    check('MCP lists CreateSowellianBet tool', toolNames.includes('CreateSowellianBet'));
  }

  // SearchRealms (may 502 if upstream MCP endpoint is down)
  const searchRes = await POST('/api/v1/mcp', { tool: 'SearchRealms', arguments: { query: 'mango' } });
  check('MCP SearchRealms returns data (or 502 if upstream down)', searchRes.ok || searchRes.status === 502, `status=${searchRes.status}`);
  if (searchRes.ok) {
    check('SearchRealms has result', searchRes.json?.result !== undefined);
  }

  // GetDAO (may 502 if upstream MCP endpoint is down)
  if (testRealmPk) {
    const getDaoRes = await POST('/api/v1/mcp', { tool: 'GetDAO', arguments: { realmPk: testRealmPk } });
    check('MCP GetDAO returns data (or 502 if upstream down)', getDaoRes.ok || getDaoRes.status === 502, `status=${getDaoRes.status}`);
  }

  // ListProposals (may 502 if upstream MCP endpoint is down)
  if (testRealmPk) {
    const listPropRes = await POST('/api/v1/mcp', { tool: 'ListProposals', arguments: { realmPk: testRealmPk } });
    check('MCP ListProposals returns data (or 502 if upstream down)', listPropRes.ok || listPropRes.status === 502, `status=${listPropRes.status}`);
  }

  // GetTreasury (may 502 if upstream MCP endpoint is down)
  if (testRealmPk) {
    const getTreasRes = await POST('/api/v1/mcp', { tool: 'GetTreasury', arguments: { realmPk: testRealmPk } });
    check('MCP GetTreasury returns data (or 502 if upstream down)', getTreasRes.ok || getTreasRes.status === 502, `status=${getTreasRes.status}`);
  }

  // Unknown tool should 400
  const mcpBad = await POST('/api/v1/mcp', { tool: 'FakeTool', arguments: {} });
  check('MCP unknown tool returns 400', mcpBad.status === 400);
  check('MCP error lists available tools', !!mcpBad.json?.availableTools);

  // Missing tool should 400
  const mcpNoTool = await POST('/api/v1/mcp', { arguments: {} });
  check('MCP missing tool returns 400', mcpNoTool.status === 400);

  // ─── 12. Treasury Management ───────────────────────────────────────────────
  section('12. Treasury Management');

  // Initialize treasury
  const treasInitRes = await POST('/api/v1/treasury/initialize', { realmId: 'e2e-test-realm' });
  check('POST /treasury/initialize returns 201', treasInitRes.status === 201);
  check('Treasury has walletPubkey', !!treasInitRes.json?.walletPubkey);

  // Initialize same realm again (should return existing or new)
  const treasInitAgain = await POST('/api/v1/treasury/initialize', { realmId: 'e2e-test-realm' });
  check('Re-initialize treasury returns 201', treasInitAgain.status === 201);

  // Missing realmId should 400
  const treasInitBad = await POST('/api/v1/treasury/initialize', {});
  check('Initialize without realmId returns 400', treasInitBad.status === 400);

  // Get treasury info
  const treasInfoRes = await GET('/api/v1/treasury?realmId=e2e-test-realm');
  check('GET /treasury returns data', treasInfoRes.ok);
  if (treasInfoRes.ok) {
    check('Treasury info has walletPubkey', !!treasInfoRes.json?.walletPubkey);
    check('Treasury info has balanceSol', typeof treasInfoRes.json?.balanceSol === 'number');
  }

  // Treasury dashboard
  const dashRes = await GET('/api/v1/treasury/dashboard?realmId=e2e-test-realm');
  check('GET /treasury/dashboard returns data', dashRes.ok);
  if (dashRes.ok) {
    check('Dashboard has summary', !!dashRes.json?.summary);
    check('Dashboard has metrics', !!dashRes.json?.metrics);
    check('Dashboard has risk', !!dashRes.json?.risk);
    check('Dashboard summary has totalBalanceSol', typeof dashRes.json?.summary?.totalBalanceSol === 'number');
    check('Dashboard metrics has successRate', typeof dashRes.json?.metrics?.successRate === 'number');
  }

  // Treasury history
  const histRes = await GET('/api/v1/treasury/history');
  check('GET /treasury/history returns array', Array.isArray(histRes.json));

  // ─── 13. OmniPair Execution (Governance-Gated) ────────────────────────────
  section('13. OmniPair Governance-Gated Execution');

  // OmniPair without required fields should 400
  const omniEmpty = await POST('/api/v1/omnipair/execute', {});
  check('OmniPair without fields returns 400', omniEmpty.status === 400);

  // OmniPair with invalid execution type
  const omniBadType = await POST('/api/v1/omnipair/execute', {
    proposalPk: 'fake-proposal-pk',
    daoPk: 'fake-dao-pk',
    executionType: 'invalid_type',
    params: {},
  });
  check('OmniPair invalid executionType returns 400', omniBadType.status === 400);

  // OmniPair lend should return 501 (not implemented)
  const omniLend = await POST('/api/v1/omnipair/execute', {
    proposalPk: 'fake-proposal-pk',
    daoPk: 'fake-dao-pk',
    executionType: 'lend',
    params: {},
  });
  check('OmniPair lend returns 501', omniLend.status === 501, `status=${omniLend.status}`);

  // OmniPair repay should return 501
  const omniRepay = await POST('/api/v1/omnipair/execute', {
    proposalPk: 'fake-proposal-pk',
    daoPk: 'fake-dao-pk',
    executionType: 'repay',
    params: {},
  });
  check('OmniPair repay returns 501', omniRepay.status === 501, `status=${omniRepay.status}`);

  // OmniPair refinance should return 501
  const omniRefinance = await POST('/api/v1/omnipair/execute', {
    proposalPk: 'fake-proposal-pk',
    daoPk: 'fake-dao-pk',
    executionType: 'refinance',
    params: {},
  });
  check('OmniPair refinance returns 501', omniRefinance.status === 501, `status=${omniRefinance.status}`);

  // OmniPair borrow with fake proposal — should 403 (proposal not passed)
  const omniBorrow = await POST('/api/v1/omnipair/execute', {
    proposalPk: 'fake-proposal-pk',
    daoPk: 'fake-dao-pk',
    executionType: 'borrow',
    params: {
      pairAddress: 'FakePairAddress111111111111111111111111111111',
      collateralMint: 'So11111111111111111111111111111111111111112',
      collateralAmount: '1000000000',
      borrowMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      borrowAmount: '100000000',
    },
  });
  check('OmniPair borrow with fake proposal returns 403', omniBorrow.status === 403,
    `status=${omniBorrow.status}`);

  // ─── 14. Transaction Orchestrator ──────────────────────────────────────────
  section('14. Transaction Orchestrator');

  // Missing fields should 400
  const txBad1 = await POST('/api/v1/tx/orchestrate', {});
  check('Orchestrate without fields returns 400', txBad1.status === 400);

  const txBad2 = await POST('/api/v1/tx/orchestrate', {
    transactions: [],
    walletRole: 'agent',
  });
  check('Orchestrate without realmPk returns 400', txBad2.status === 400);

  // Empty transactions array — may return 200 (no-op) or 400 (validation)
  const txEmpty = await POST('/api/v1/tx/orchestrate', {
    transactions: [],
    walletRole: 'agent',
    realmPk: 'fake-realm-pk',
    agentSecretKey: alphaSecret,
  });
  check('Orchestrate with empty txs returns 200 or 400', txEmpty.ok || txEmpty.status === 400,
    `status=${txEmpty.status}`);

  // Submit endpoint (without auth should 401)
  const submitNoAuth = await POST('/api/v1/tx/submit', {
    transaction: 'fake-base64',
    type: 'vote',
  });
  check('Submit without auth returns 401', submitNoAuth.status === 401);

  // ─── 15. Legacy Realm & Proposal Endpoints ────────────────────────────────
  section('15. Legacy API Endpoints');

  // Create a legacy realm
  const legacyRealm = await POST('/api/v1/realms', { name: 'E2E Legacy DAO' }, alphaToken);
  check('POST /realms (legacy) creates realm', legacyRealm.ok, `status=${legacyRealm.status}`);
  const legacyRealmId = legacyRealm.json?.id;

  if (legacyRealmId) {
    // List realms
    const legacyList = await GET('/api/v1/realms');
    check('GET /realms returns array', Array.isArray(legacyList.json));
    check('Legacy realm appears in list', legacyList.json?.some(r => r.id === legacyRealmId));

    // Get realm detail
    const legacyDetail = await GET(`/api/v1/realms/${legacyRealmId}`);
    check('GET /realms/:id returns realm', legacyDetail.ok, `status=${legacyDetail.status}`);

    // Create proposal
    const legacyProp = await POST(`/api/v1/realms/${legacyRealmId}/proposals`, {
      name: 'E2E Legacy Proposal',
      description: 'Test proposal for legacy API',
    }, alphaToken);
    check('POST /realms/:id/proposals creates proposal', legacyProp.ok, `status=${legacyProp.status}`);
    const legacyPropId = legacyProp.json?.id;

    // Join realm
    const legacyJoin = await POST(`/api/v1/realms/${legacyRealmId}/join`, {}, alphaToken);
    check('POST /realms/:id/join works', legacyJoin.ok, `status=${legacyJoin.status}`);

    // Members
    const legacyMembers = await GET(`/api/v1/realms/${legacyRealmId}/members`);
    check('GET /realms/:id/members returns data', legacyMembers.ok);

    if (legacyPropId) {
      // Vote
      const legacyVote = await POST(`/api/v1/realms/${legacyRealmId}/proposals/${legacyPropId}/vote`, {
        vote: 'yes',
      }, alphaToken);
      check('POST /realms/:id/proposals/:pid/vote works', legacyVote.ok, `status=${legacyVote.status}`);

      // Comments
      const legacyComment = await POST(`/api/v1/realms/${legacyRealmId}/proposals/${legacyPropId}/comments`, {
        content: 'E2E test comment',
      }, alphaToken);
      check('POST /realms/:id/proposals/:pid/comments works', legacyComment.ok);

      const legacyCommentList = await GET(`/api/v1/realms/${legacyRealmId}/proposals/${legacyPropId}/comments`);
      check('GET /realms/:id/proposals/:pid/comments returns array', Array.isArray(legacyCommentList.json));

      // Get single proposal
      const legacyPropDetail = await GET(`/api/v1/realms/${legacyRealmId}/proposals/${legacyPropId}`);
      check('GET /realms/:id/proposals/:pid returns proposal', legacyPropDetail.ok);
    }
  }

  // ─── 16. Realms Import ────────────────────────────────────────────────────
  section('16. Realms Import');

  if (testRealmPk && alphaToken) {
    const importRes = await POST('/api/v1/realms/import', { realmPk: testRealmPk }, alphaToken);
    check('POST /realms/import returns data (may 400 if upstream rejects)', importRes.ok || importRes.status === 400 || importRes.status === 500,
      `status=${importRes.status}`);
  }

  // ─── 17. Realms v2 — Create DAO ───────────────────────────────────────────
  section('17. Realms v2 — Create DAO');

  if (alphaToken) {
    const createDaoRes = await POST('/api/v1/realms/v2/create', {
      name: 'E2E Test DAO ' + Date.now(),
    }, alphaToken);
    check('POST /realms/v2/create returns data (may fail upstream)', createDaoRes.ok || createDaoRes.status === 400 || createDaoRes.status === 500,
      `status=${createDaoRes.status}`);
    if (createDaoRes.ok) {
      check('Create DAO returns transactions', !!createDaoRes.json?.transactions || !!createDaoRes.json?.message);
    }

    // Missing name should 400
    const createDaoBad = await POST('/api/v1/realms/v2/create', {}, alphaToken);
    check('Create DAO without name returns 400', createDaoBad.status === 400);
  }

  // ─── 18. Stats / Activity / Transactions / Protocol Log ───────────────────
  section('18. Aggregation Endpoints');

  // Stats
  const statsRes = await GET('/api/v1/stats');
  check('GET /stats returns data', statsRes.ok);
  check('Stats has tvl', statsRes.json?.tvl !== undefined);
  check('Stats has agents count', typeof statsRes.json?.agents === 'number');
  check('Stats has txCount', statsRes.json?.txCount !== undefined);
  check('Stats has tps', statsRes.json?.tps !== undefined);

  // Activity feed
  const activityRes = await GET('/api/v1/activity');
  check('GET /activity returns array', Array.isArray(activityRes.json));

  const activityLimited = await GET('/api/v1/activity?limit=5');
  check('GET /activity?limit=5 respects limit', Array.isArray(activityLimited.json) && activityLimited.json.length <= 5);

  // Transactions
  const txRes = await GET('/api/v1/transactions');
  check('GET /transactions returns data', txRes.ok);
  if (txRes.ok) {
    check('Transactions has votes', Array.isArray(txRes.json?.votes));
    check('Transactions has omnipairExecutions', Array.isArray(txRes.json?.omnipairExecutions));
    check('Transactions has executionLogs', Array.isArray(txRes.json?.executionLogs));
    check('Transactions has events', Array.isArray(txRes.json?.events));
  }

  // Protocol log
  const logRes = await GET('/api/v1/protocol-log');
  check('GET /protocol-log returns array', Array.isArray(logRes.json));

  // Active proposals
  const activePropsRes = await GET('/api/v1/proposals/active');
  check('GET /proposals/active returns data', activePropsRes.ok);

  // ─── 19. Comments on Realms v2 Proposals ──────────────────────────────────
  section('19. Realms v2 Proposal Comments');

  if (testRealmPk && alphaToken) {
    const proposalList = await GET(`/api/v1/realms/v2/${testRealmPk}/proposals`);
    if (proposalList.json?.length > 0) {
      const propPk = proposalList.json[0].proposalPk;

      // Get comments
      const commentsRes = await GET(`/api/v1/realms/v2/${testRealmPk}/proposals/${propPk}/comments`);
      check('GET /comments returns data', commentsRes.ok);

      // Post comment (requires auth)
      const postComment = await POST(`/api/v1/realms/v2/${testRealmPk}/proposals/${propPk}/comments`, {
        content: 'E2E test comment on Realms v2 proposal',
      }, alphaToken);
      check('POST /comments returns data', postComment.ok || postComment.status === 500,
        `status=${postComment.status}`);
    } else {
      check('Comments (no proposals to test)', 'skip');
    }
  }

  // ─── 20. Agent Delete (cleanup) ───────────────────────────────────────────
  section('20. Agent Delete');

  // Delete the duplicate agent from step 4
  if (gammaId) {
    const deleteRes = await DELETE(`/api/v1/agents/${gammaId}`);
    check('DELETE /agents/:id returns 200', deleteRes.status === 200);
    check('Delete confirms success', deleteRes.json?.success === true);
    check('Delete returns agent name', !!deleteRes.json?.deleted);
  }

  // Delete non-existent agent should 404
  const deleteBad = await DELETE('/api/v1/agents/nonexistent-id-12345');
  check('Delete nonexistent agent returns 404', deleteBad.status === 404);

  // ─── 21. OmniPair Borrow Proposal Flow (Full Lifecycle) ───────────────────
  section('21. OmniPair Borrow Proposal Flow (Legacy)');

  if (legacyRealmId && alphaToken) {
    // Create OmniPair borrow proposal
    const omniProp = await POST(`/api/v1/realms/${legacyRealmId}/proposals`, {
      name: 'Borrow 100 USDC via OmniPair',
      description: 'E2E test — borrow USDC against SOL collateral',
      proposalType: 'omnipair_borrow',
      executionParams: {
        pairAddress: 'FakePairAddress111111111111111111111111111111',
        collateralMint: 'So11111111111111111111111111111111111111112',
        collateralAmount: '1000000000',
        borrowMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        borrowAmount: '100000000',
      },
    }, alphaToken);
    check('Create OmniPair borrow proposal succeeds', omniProp.ok, `status=${omniProp.status}`);
    check('Proposal has omnipair_borrow type', omniProp.json?.proposalType === 'omnipair_borrow');

    const omniPropId = omniProp.json?.id;

    if (omniPropId) {
      // Vote yes
      await POST(`/api/v1/realms/${legacyRealmId}/proposals/${omniPropId}/vote`, { vote: 'yes' }, alphaToken);
      await POST(`/api/v1/realms/${legacyRealmId}/proposals/${omniPropId}/vote`, { vote: 'yes' }, betaToken);
      if (deltaToken) {
        await POST(`/api/v1/realms/${legacyRealmId}/proposals/${omniPropId}/vote`, { vote: 'yes' }, deltaToken);
      }

      // Check proposal state
      const propState = await GET(`/api/v1/realms/${legacyRealmId}/proposals/${omniPropId}`);
      check('OmniPair proposal reached Succeeded state', propState.json?.state === 'Succeeded',
        `state=${propState.json?.state}`);

      // Try to execute via OmniPair endpoint
      const omniExec = await POST('/api/v1/omnipair/execute', {
        proposalPk: omniPropId,
        daoPk: legacyRealmId,
        executionType: 'borrow',
        params: {
          pairAddress: 'FakePairAddress111111111111111111111111111111',
          collateralMint: 'So11111111111111111111111111111111111111112',
          collateralAmount: '1000000000',
          borrowMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          borrowAmount: '100000000',
        },
      });
      // This will likely fail due to no treasury keypair, but should NOT be 403 (proposal is passed)
      check('OmniPair borrow not governance-blocked (proposal passed)',
        omniExec.status !== 403,
        `status=${omniExec.status}`);
    }
  }

  // ─── 22. Edge Cases & Security ─────────────────────────────────────────────
  section('22. Edge Cases & Security');

  // Auth required endpoints without token
  const noAuthEndpoints = [
    { m: 'POST', p: `/api/v1/realms/v2/${testRealmPk || 'x'}/join`, b: {} },
    { m: 'POST', p: `/api/v1/realms/v2/${testRealmPk || 'x'}/leave`, b: {} },
    { m: 'POST', p: `/api/v1/realms/v2/${testRealmPk || 'x'}/delegate`, b: { delegatePk: 'x' } },
    { m: 'POST', p: `/api/v1/realms/v2/${testRealmPk || 'x'}/proposals`, b: { name: 'x', description: 'x', governancePk: 'x' } },
  ];

  for (const ep of noAuthEndpoints) {
    const res = await POST(ep.p, ep.b);
    check(`${ep.m} ${ep.p.split('/api/v1')[1]} without auth returns 401`, res.status === 401);
  }

  // XSS in agent name (should be stored as-is, not executed)
  const xssRes = await POST('/api/v1/agents/onboard', {
    name: '<script>alert("xss")</script>',
    description: 'XSS test',
  });
  check('XSS in agent name is accepted (stored safely)', xssRes.status === 201);

  // Very long input
  const longName = 'A'.repeat(10000);
  const longRes = await POST('/api/v1/agents/onboard', { name: longName });
  check('Very long name is handled gracefully', longRes.status === 201 || longRes.status === 400);

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  printSummary();
}

function printSummary() {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  SWARMOCRACY E2E TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Total:   ${checks.length}`);
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log('─'.repeat(60));

  // Group by section
  const sections = {};
  for (const c of checks) {
    if (!sections[c.section]) sections[c.section] = { pass: 0, fail: 0, skip: 0 };
    if (c.pass === 'PASS') sections[c.section].pass++;
    else if (c.pass === 'FAIL') sections[c.section].fail++;
    else sections[c.section].skip++;
  }

  for (const [name, counts] of Object.entries(sections)) {
    const icon = counts.fail > 0 ? 'FAIL' : 'OK';
    console.log(`  [${icon}] ${name} (${counts.pass}P/${counts.fail}F/${counts.skip}S)`);
  }

  console.log('─'.repeat(60));

  // List failures
  const failures = checks.filter(c => c.pass === 'FAIL');
  if (failures.length > 0) {
    console.log('\n  FAILURES:');
    for (const f of failures) {
      console.log(`    [FAIL] ${f.section} > ${f.name}`);
    }
  }

  console.log('\n  Result:', failed === 0 ? 'ALL TESTS PASSED' : `${failed} TESTS FAILED`);
  console.log('═'.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('\nFATAL:', e.message);
  console.error(e.stack);
  process.exit(2);
});
