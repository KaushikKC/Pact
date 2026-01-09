# Pact - DeFi Primitive for Stake-Backed Position Commitments

![Movement](https://img.shields.io/badge/Built%20on-Movement-blue)
![Move](https://img.shields.io/badge/Language-Move-orange)
![License](https://img.shields.io/badge/License-MIT-green)

**Pact** is a decentralized finance (DeFi) primitive that enables stake-backed commitments to hold onchain positions until specified conditions or deadlines are met.

## Overview

Pact provides a trustless mechanism for users to make verifiable commitments about their onchain token holdings. By staking native tokens (MOVE), users can create enforceable pacts that demonstrate their commitment to maintaining a position until a deadline.

## Links

- **Demo Video**: https://www.youtube.com/watch?v=HvvGqhEiTFY
- **Live Demo**: https://pact-m1.vercel.app/


### Core Value Proposition

- **DeFi-Focused**: Onchain position management with economic stakes
- **Fully Verifiable**: All commitments verified onchain without external dependencies
- **Oracle-Free**: Uses native blockchain balance checks
- **Trustless**: No offchain attestations required

## MVP: DeFi Position Holding Commitment

The minimum viable product (MVP) focuses on a single, well-defined use case: **"I commit to not selling token X until timestamp T."**

### Key Characteristics

| Aspect | Specification |
|--------|---------------|
| **Pact Type** | Position holding commitment until deadline |
| **Stake Asset** | MOVE (native token) |
| **Resolution Rule** | Balance at start ≥ balance at deadline = PASS |
| **Slashing Split** | 90% returned to creator, 10% protocol fee |
| **Network** | Movement Testnet |
| **Minimum Stake** | 0.01 MOVE (1,000,000 octas) |
| **Verification** | Onchain balance check (no oracles required) |

## System Flow

### 1. Pact Creation

Users create a pact by specifying:
- Token address to track
- Stake amount in MOVE tokens
- Deadline timestamp

### 2. Stake Escrow

Upon creation:
- Stake is escrowed in the smart contract
- Initial token balance is recorded onchain
- Pact status is set to Active

### 3. Resolution

After the deadline:
- Anyone can resolve the pact
- Current balance is compared to initial balance
- Outcome is determined automatically

### 4. Settlement

Based on the outcome:
- **Position Maintained**: Full stake returned to creator
- **Position Sold**: Stake slashed (90% returned, 10% protocol fee)

## Architecture

### Smart Contract Design

The system is built natively on Movement using Move's resource model for maximum safety and security.

**Pact Resource Structure:**
```
Pact (Resource)
├── creator: address
├── token_address: address (tracked token)
├── start_balance: u64
├── stake_amount: u64 (in MOVE)
├── deadline: u64 (unix timestamp)
├── status: u8 (Active=0, Passed=1, Failed=2)
├── escrowed_stake: Coin<AptosCoin>
├── challenge: vector<Challenge>
├── is_group: bool
├── max_group_size: u64
└── group_members: vector<GroupMember>
```

### Core Functions

#### `create_pact()`
- Locks MOVE tokens as stake
- Records initial token balance
- Sets commitment deadline
- Emits `PactCreatedEvent`

#### `create_group_pact()`
- Creates a group pact with configurable maximum size
- Allows multiple users to join and stake together
- Emits `GroupPactCreatedEvent`

#### `join_group_pact()`
- Allows users to join existing group pacts
- Records individual member stakes and balances
- Emits `GroupMemberJoinedEvent`

#### `challenge_pact()`
- Enables users to stake against an active pact
- Creates adversarial incentives
- Emits `PactChallengedEvent`

#### `resolve_pact()`
- Can be called by anyone after deadline
- Checks current balance against initial balance
- For group pacts, checks all members' balances
- Distributes stakes based on outcome
- Emits `PactResolvedEvent`
- Prevents double resolution (non-duplicable resource)

#### `cancel_pact()`
- Emergency exit mechanism before deadline
- Treated as failure (stake slashed)

### Security Features

- **Non-duplicable Resources**: Each pact can only be resolved once
- **Escrow-Based**: Stake locked in contract (not just a promise)
- **Permissionless Resolution**: Anyone can resolve after deadline
- **Oracle-Free**: Onchain balance verification only
- **Timestamp-Based**: Deterministic deadline enforcement
- **Group Pact Support**: Multiple members with individual balance tracking
- **Challenge Mechanism**: Adversarial staking for additional accountability

## Project Structure

```
pact/
├── modules/                      # Move smart contracts
│   ├── Move.toml                 # Package manifest
│   ├── sources/
│   │   └── pact.move             # Core pact module
│   └── tests/
│       └── pact_tests.move       # Comprehensive unit tests
├── app/                          # Next.js frontend
│   ├── components/              # React components
│   │   ├── layout/              # Layout components
│   │   ├── pact/                # Pact-specific components
│   │   └── ui/                  # UI primitives
│   ├── contexts/                # React contexts
│   ├── lib/                     # Service libraries
│   │   ├── aptos.ts             # Aptos SDK configuration
│   │   ├── pactService.ts       # Pact service layer
│   │   ├── pactTransactions.ts  # Transaction handlers
│   │   └── wallet.ts            # Wallet utilities
│   ├── create/                  # Pact creation page
│   ├── leaderboard/             # Public pacts listing
│   ├── pacts/                   # Pact detail pages
│   ├── profile/                 # User profile pages
│   └── resolve/                 # Pact resolution page
├── scripts/                     # Deployment scripts
│   └── deploy.sh                # Contract deployment script
└── README.md
```

## Getting Started

### Prerequisites

- **Movement CLI**: [Install Movement](https://docs.movementlabs.xyz)
- **Node.js 18+**: Required for frontend development
- **Wallet**: Movement-compatible wallet (e.g., Petra, Martian)

### Building the Smart Contract

```bash
cd modules
movement move compile
```

### Running Tests

```bash
movement move test
```

Expected test output:
```
Running Move unit tests
[ PASS    ] pact_addr::pact_tests::test_pact_pass
[ PASS    ] pact_addr::pact_tests::test_pact_fail
[ PASS    ] pact_addr::pact_tests::test_double_resolve_fails
[ PASS    ] pact_addr::pact_tests::test_resolve_before_deadline_fails
[ PASS    ] pact_addr::pact_tests::test_insufficient_stake_fails
[ PASS    ] pact_addr::pact_tests::test_past_deadline_fails
[ PASS    ] pact_addr::pact_tests::test_cancel_pact
[ PASS    ] pact_addr::pact_tests::test_multiple_pacts
[ PASS    ] pact_addr::pact_tests::test_view_functions
Test result: OK. Total tests: 9; passed: 9; failed: 0
```

### Deploying to Movement Testnet

```bash
# Initialize account (if needed)
movement account create --account default

# Fund account with testnet MOVE
# Visit Movement testnet faucet: https://faucet.movementlabs.xyz

# Publish module
movement move publish --named-addresses pact_addr=default
```

### Contract Interaction Examples

#### Initialize Protocol
```bash
movement move run \
  --function-id 'default::pact::initialize'
```

#### Create a Solo Pact
```bash
movement move run \
  --function-id 'default::pact::create_pact' \
  --args address:0x123... u64:1000 u64:10000000 u64:1735000000
```

#### Create a Group Pact
```bash
movement move run \
  --function-id 'default::pact::create_group_pact' \
  --args address:0x123... u64:1000 u64:10000000 u64:1735000000 u64:5
```

#### Challenge a Pact
```bash
movement move run \
  --function-id 'default::pact::challenge_pact' \
  --args address:0x123... u64:0 u64:5000000
```

#### Resolve a Pact
```bash
movement move run \
  --function-id 'default::pact::resolve_pact' \
  --args address:0x123... u64:0 u64:1200
```

### Frontend Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Features

### Solo Pacts

Individual users can create commitments to hold a token position until a deadline. The stake is escrowed and returned if the commitment is met.

### Group Pacts

Multiple users can join together in a group pact, all staking tokens. If any member breaks the commitment, penalties are redistributed among compliant members or burned.

### Challenge Mechanism

Any user can challenge an active pact by staking against it. If the creator succeeds, they win the challenger's stake. If they fail, the challenger wins and the creator is slashed.

### Public Timeline

Each pact page displays a chronological timeline of events including:
- Pact creation
- Stake locking
- Challenges
- Group member joins
- Deadline reached
- Resolution status (Pass/Fail)

## Test Coverage

| Test | Description | Status |
|------|-------------|--------|
| `test_pact_pass` | User maintains balance → full stake returned | Pass |
| `test_pact_fail` | User sold tokens → stake slashed (90/10) | Pass |
| `test_double_resolve_fails` | Prevent resolving same pact twice | Pass |
| `test_resolve_before_deadline_fails` | Cannot resolve early | Pass |
| `test_insufficient_stake_fails` | Minimum stake enforcement | Pass |
| `test_past_deadline_fails` | Deadline must be in future | Pass |
| `test_cancel_pact` | Voluntary exit with slashing | Pass |
| `test_multiple_pacts` | Multiple pacts per user | Pass |
| `test_view_functions` | Query functions work correctly | Pass |

## Use Cases

### Primary Use Case: DeFi Position Holding Commitment

**Example**: "I commit to not selling token X until timestamp T."

**Process**:
1. User stakes MOVE tokens
2. Initial token balance is recorded
3. Deadline timestamp is set
4. At deadline, balance is checked automatically
5. Settlement occurs:
   - Position held → Full stake returned
   - Position sold → Stake slashed (90/10 split)

**Advantages**:
- Pure DeFi (onchain position management)
- No oracles required (native balance checks)
- No offchain attestations (fully verifiable)
- Clear economic enforcement mechanism

### Extended Use Cases (Future)

Potential future directions for expansion:
- Friend group accountability pacts
- Alpha signal credibility staking
- DAO contributor commitment tracking
- Recurring goal commitments

## Security Considerations

### Audited Patterns

- Escrow pattern with locked coins
- Status-based state machine
- Single-resolution enforcement
- Timestamp-based deadlines
- Resource-based ownership model

### Known Limitations (MVP)

- **Manual Balance Reporting**: Resolver must provide current balance (future: oracle integration)
- **No Dispute Mechanism**: Resolution is final (future: appeals process)
- **Fixed Slashing Ratio**: 90/10 split is hardcoded (future: configurable ratios)

### Future Security Enhancements

- Formal verification of core logic
- Third-party security audit before mainnet deployment
- Bug bounty program
- Multi-signature resolution for high-value pacts

## Gas Efficiency

Movement's low gas costs make Pact practical for everyday commitments:

| Operation | Estimated Gas | USD (est.) |
|-----------|---------------|------------|
| Create Pact | ~2,000 gas | ~$0.001 |
| Resolve Pact | ~3,000 gas | ~$0.0015 |
| Challenge Pact | ~2,500 gas | ~$0.0012 |
| Join Group Pact | ~2,000 gas | ~$0.001 |
| View Functions | Free | $0 |

This enables micro-commitments that would be impractical on high-gas networks like Ethereum (~$10-50 per transaction).

## API Reference

### View Functions

- `get_pact(creator: address, pact_index: u64)`: Returns pact details
- `get_user_pact_count(creator: address)`: Returns number of pacts for a user
- `get_protocol_stats()`: Returns protocol-wide statistics
- `get_challenge(creator: address, pact_index: u64)`: Returns challenge details
- `get_group_members(creator: address, pact_index: u64)`: Returns group member list

### Entry Functions

- `initialize()`: Initialize the protocol (deployer only)
- `create_pact()`: Create a solo pact
- `create_group_pact()`: Create a group pact
- `join_group_pact()`: Join an existing group pact
- `challenge_pact()`: Challenge an active pact
- `resolve_pact()`: Resolve a pact after deadline
- `cancel_pact()`: Cancel a pact before deadline

## Contributing

Contributions are welcome. Areas of particular interest:

- Additional pact types and use cases
- Oracle integration for external data
- Frontend improvements and UX enhancements
- Security analysis and audits
- Documentation improvements
- Test coverage expansion

## License

MIT License - see LICENSE file for details

## Acknowledgments

Built for M1 Hackathon on Movement Labs.

Special thanks to the Movement team for creating a high-performance Move environment that makes behavioral DeFi practical and accessible.

---

**Built on Movement**
