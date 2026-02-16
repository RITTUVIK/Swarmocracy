const API = 'http://localhost:3000';

async function test() {
  // STEP 1: OpenClaw Agent installs skill & onboards
  console.log('=== STEP 1: Agent Alpha Onboards (simulating OpenClaw skill install) ===');
  const onboardAlpha = await fetch(API + '/api/v1/agents/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alpha', description: 'OpenClaw governance agent' })
  }).then(r => r.json());
  console.log('  Name:', onboardAlpha.agent.name);
  console.log('  Wallet:', onboardAlpha.agent.walletPubkey);
  console.log('  Token received:', !!onboardAlpha.token);
  console.log('  Secret key received:', !!onboardAlpha.wallet.secretKey);
  const alphaToken = onboardAlpha.token;
  const alphaSecret = onboardAlpha.wallet.secretKey;

  // STEP 2: Second agent onboards
  console.log('\n=== STEP 2: Agent Beta Onboards ===');
  const onboardBeta = await fetch(API + '/api/v1/agents/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Beta', description: 'Voting delegate agent' })
  }).then(r => r.json());
  console.log('  Name:', onboardBeta.agent.name);
  console.log('  Wallet:', onboardBeta.agent.walletPubkey);
  const betaToken = onboardBeta.token;

  // STEP 3: List all agents
  console.log('\n=== STEP 3: List Agents ===');
  const agents = await fetch(API + '/api/v1/agents').then(r => r.json());
  console.log('  Registered agents:', agents.length);
  agents.forEach(a => console.log('  -', a.name, '(' + a.walletPubkey.slice(0, 8) + '...)'));

  // STEP 4: Re-authenticate via /auth/login (token refresh simulation)
  console.log('\n=== STEP 4: Re-authenticate via /auth/login ===');
  const reauth = await fetch(API + '/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secretKey: alphaSecret })
  }).then(r => r.json());
  console.log('  Re-auth successful:', !!reauth.token);
  console.log('  Registered:', reauth.registered);
  const alphaFreshToken = reauth.token;

  // STEP 5: Create a Realm (DAO)
  console.log('\n=== STEP 5: Create Realm (DAO) ===');
  const realm = await fetch(API + '/api/v1/realms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + alphaFreshToken },
    body: JSON.stringify({ name: 'SwarmDAO' })
  }).then(r => r.json());
  console.log('  Realm created:', realm.name);
  console.log('  ID:', realm.id);
  const realmId = realm.id;

  // STEP 6: List Realms
  console.log('\n=== STEP 6: List Realms ===');
  const realms = await fetch(API + '/api/v1/realms').then(r => r.json());
  console.log('  Total realms:', realms.length);
  realms.forEach(r => console.log('  -', r.name));

  // STEP 7: Get Realm Details
  console.log('\n=== STEP 7: Get Realm Details ===');
  const realmDetail = await fetch(API + '/api/v1/realms/' + realmId).then(r => r.json());
  console.log('  Name:', realmDetail.name);
  console.log('  Proposals:', (realmDetail.proposals || []).length);

  // STEP 8: Alpha creates Proposal 1
  console.log('\n=== STEP 8: Create Proposal 1 ===');
  const proposal = await fetch(API + '/api/v1/realms/' + realmId + '/proposals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + alphaFreshToken },
    body: JSON.stringify({
      name: 'Fund AI Research',
      description: 'Allocate 1000 tokens to fund open-source AI safety research. 3 grants over 6 months.'
    })
  }).then(r => r.json());
  console.log('  Proposal:', proposal.name);
  console.log('  State:', proposal.state);
  const proposalId = proposal.id;

  // STEP 9: Beta creates Proposal 2
  console.log('\n=== STEP 9: Create Proposal 2 ===');
  const proposal2 = await fetch(API + '/api/v1/realms/' + realmId + '/proposals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + betaToken },
    body: JSON.stringify({
      name: 'Community Events Budget',
      description: 'Set aside 500 tokens for quarterly community hackathons and workshops.'
    })
  }).then(r => r.json());
  console.log('  Proposal:', proposal2.name);
  console.log('  State:', proposal2.state);
  const proposal2Id = proposal2.id;

  // STEP 10: List proposals
  console.log('\n=== STEP 10: List Proposals ===');
  const proposals = await fetch(API + '/api/v1/realms/' + realmId + '/proposals').then(r => r.json());
  console.log('  Total proposals:', proposals.length);
  proposals.forEach(p => console.log('  -', p.name, '[' + p.state + ']'));

  // STEP 11: Alpha comments on proposal 1
  console.log('\n=== STEP 11: Alpha Comments ===');
  const comment1 = await fetch(API + '/api/v1/realms/' + realmId + '/proposals/' + proposalId + '/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + alphaFreshToken },
    body: JSON.stringify({ content: 'I strongly support this. AI safety research is critical for responsible development.' })
  }).then(r => r.json());
  console.log('  Posted by:', comment1.agent && comment1.agent.name);
  console.log('  Content:', (comment1.content || '').slice(0, 60) + '...');

  // STEP 12: Beta comments on proposal 1
  console.log('\n=== STEP 12: Beta Comments ===');
  const comment2 = await fetch(API + '/api/v1/realms/' + realmId + '/proposals/' + proposalId + '/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + betaToken },
    body: JSON.stringify({ content: 'Agreed, but I suggest milestone-based fund release for accountability.' })
  }).then(r => r.json());
  console.log('  Posted by:', comment2.agent && comment2.agent.name);
  console.log('  Content:', (comment2.content || '').slice(0, 60) + '...');

  // STEP 13: Alpha votes YES on proposal 1
  console.log('\n=== STEP 13: Alpha Votes YES on Proposal 1 ===');
  const vote1 = await fetch(API + '/api/v1/realms/' + realmId + '/proposals/' + proposalId + '/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + alphaFreshToken },
    body: JSON.stringify({ vote: 'yes' })
  }).then(r => r.json());
  console.log('  Vote:', vote1.vote, '| Tally:', JSON.stringify(vote1.tally));

  // STEP 14: Beta votes YES on proposal 1
  console.log('\n=== STEP 14: Beta Votes YES on Proposal 1 ===');
  const vote2 = await fetch(API + '/api/v1/realms/' + realmId + '/proposals/' + proposalId + '/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + betaToken },
    body: JSON.stringify({ vote: 'yes' })
  }).then(r => r.json());
  console.log('  Vote:', vote2.vote, '| Tally:', JSON.stringify(vote2.tally));

  // STEP 15: Alpha votes NO on proposal 2
  console.log('\n=== STEP 15: Alpha Votes NO on Proposal 2 ===');
  const vote3 = await fetch(API + '/api/v1/realms/' + realmId + '/proposals/' + proposal2Id + '/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + alphaFreshToken },
    body: JSON.stringify({ vote: 'no' })
  }).then(r => r.json());
  console.log('  Vote:', vote3.vote, '| Tally:', JSON.stringify(vote3.tally));

  // STEP 16: Beta votes ABSTAIN on proposal 2
  console.log('\n=== STEP 16: Beta Votes ABSTAIN on Proposal 2 ===');
  const vote4 = await fetch(API + '/api/v1/realms/' + realmId + '/proposals/' + proposal2Id + '/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + betaToken },
    body: JSON.stringify({ vote: 'abstain' })
  }).then(r => r.json());
  console.log('  Vote:', vote4.vote, '| Tally:', JSON.stringify(vote4.tally));

  // STEP 17: Full proposal thread
  console.log('\n=== STEP 17: Full Proposal Thread ===');
  const fullProposal = await fetch(API + '/api/v1/realms/' + realmId + '/proposals/' + proposalId).then(r => r.json());
  console.log('  Proposal:', fullProposal.name, '[' + fullProposal.state + ']');
  console.log('  Comments:', (fullProposal.comments || []).length);
  (fullProposal.comments || []).forEach(c => console.log('    [' + (c.agent && c.agent.name) + ']:', (c.content || '').slice(0, 50)));

  // STEP 18: Agent profile with activity
  console.log('\n=== STEP 18: Agent Profile ===');
  const alphaProfile = await fetch(API + '/api/v1/agents/' + onboardAlpha.agent.id).then(r => r.json());
  console.log('  Name:', alphaProfile.name);
  console.log('  Recent comments:', (alphaProfile.comments || []).length);

  // STEP 19: Realm final state
  console.log('\n=== STEP 19: Realm Final State ===');
  const finalRealm = await fetch(API + '/api/v1/realms/' + realmId).then(r => r.json());
  console.log('  Realm:', finalRealm.name);
  console.log('  Proposals:', (finalRealm.proposals || []).length);
  (finalRealm.proposals || []).forEach(p => console.log('    -', p.name, '[' + p.state + ']'));

  // SUMMARY
  console.log('\n' + '='.repeat(60));
  console.log('E2E TEST SUMMARY');
  console.log('='.repeat(60));
  const checks = [
    ['Agent onboarding (wallet + JWT)', !!alphaToken && !!betaToken],
    ['Re-auth via /auth/login', !!reauth.token && reauth.registered],
    ['Realm (DAO) creation', !!realmId],
    ['Multiple proposals created', !!proposalId && !!proposal2Id],
    ['Commenting on proposals', (fullProposal.comments || []).length === 2],
    ['Voting (YES)', vote2.tally && vote2.tally.yes === 2],
    ['Voting (NO)', vote3.tally && vote3.tally.no === 1],
    ['Voting (ABSTAIN)', vote4.tally && vote4.tally.abstain === 1],
    ['Agent profile shows activity', (alphaProfile.comments || []).length >= 1],
    ['Realm lists all proposals', (finalRealm.proposals || []).length === 2],
    ['Multi-agent participation', agents.length === 2],
  ];

  let allPassed = true;
  checks.forEach(([name, pass]) => {
    const icon = pass ? 'PASS' : 'FAIL';
    if (!pass) allPassed = false;
    console.log('  [' + icon + '] ' + name);
  });

  console.log('\nResult:', allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
}

test().catch(e => console.error('FATAL:', e.message));
